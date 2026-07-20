// backend/controllers/ordersController.js
const db = require("../config/db");
const { streamOrderPDF } = require("../utils/pdfGenerator");
const {
  obtenerItems,
  obtenerItemsDeVarios,
  recalcularTotal,
} = require("../utils/pedidoItems");

// ------------------------------------------------------------
// Normaliza los items para guardar JSON válido
// ------------------------------------------------------------
function normalizeItems(items) {
  return items.map((i) => ({
    id_platillo: Number(i.id_platillo),
    name: i.name || i.nombre || "",
    price: Number(i.price ?? i.precio ?? 0),
    quantity: Number(i.quantity ?? 1),
    // Indicación para cocina: "sin cebolla", "término medio"...
    nota: String(i.nota ?? "").trim().slice(0, 120),
  }));
}

// Nota: mergeItems() y calculateTotal() desaparecieron al normalizar.
// La acumulación de platillos repetidos ahora se resuelve con un
// UPDATE sobre detalle_comanda, y el total se deriva del propio
// detalle con SUM(cantidad * precio_unitario) — ver utils/pedidoItems.

// ============================================================
// 1. CREAR O ACTUALIZAR PEDIDO (MOZO)
// ============================================================
exports.createOrder = async (req, res) => {
  const { tableId, waiterId, items } = req.body;

  if (!tableId || !waiterId || !items || !items.length) {
    return res.status(400).json({ error: "Datos incompletos" });
  }

  try {
    // Normalizar items (solamente campos válidos)
    const normalizedNewItems = normalizeItems(items);

    // Todo el bloque va en una transacción y arranca bloqueando la mesa.
    // Sin ese bloqueo, dos mozos añadiendo platillos a la misma mesa a la
    // vez leerían el mismo pedido y el último UPDATE pisaría al anterior,
    // perdiendo platillos silenciosamente.
    const resultado = await db.withTransaction(async (tx) => {
      const [[mesa]] = await tx.query(
        `SELECT id_mesa FROM mesa WHERE id_mesa = ? FOR UPDATE`,
        [tableId]
      );

      if (!mesa) {
        const err = new Error("MESA_NO_EXISTE");
        err.code = "MESA_NO_EXISTE";
        throw err;
      }

      // Buscar pedido abierto de esa mesa (ya serializado por el bloqueo)
      const [[existing]] = await tx.query(
        `SELECT id_pedido, estado
         FROM pedidos
         WHERE id_mesa = ?
           AND estado IN ('pendiente', 'listo', 'servido')
         ORDER BY fecha_creacion DESC
         LIMIT 1`,
        [tableId]
      );

      // 🟢 Caso 1: hay un pedido PENDIENTE → se acumulan los platillos
      // 🔥 Caso 2: el anterior ya salió de cocina → se abre uno nuevo
      // 🆕 Caso 3: la mesa no tenía pedido → se abre el primero
      let idPedido;
      let mensaje;

      if (existing && existing.estado === "pendiente") {
        idPedido = existing.id_pedido;
        mensaje = "Pedido actualizado (merge)";

        await tx.query(
          `UPDATE pedidos SET fecha_creacion = NOW() WHERE id_pedido = ?`,
          [idPedido]
        );
      } else {
        const [result] = await tx.query(
          `INSERT INTO pedidos (id_mesa, id_personal, total, estado, fecha_creacion)
           VALUES (?, ?, 0, 'pendiente', NOW())`,
          [tableId, waiterId]
        );

        idPedido = result.insertId;
        mensaje = existing
          ? "Nuevo pedido creado (por actualización)"
          : "Pedido creado";

        // La mesa queda ocupada y asignada al mozo que la atiende
        await tx.query(
          `UPDATE mesa
           SET estado = 'Ocupada', id_personal_asignado = ?
           WHERE id_mesa = ?`,
          [waiterId, tableId]
        );
      }

      // El detalle ahora son filas reales. Un platillo repetido con la
      // MISMA nota suma cantidad; con otra nota va en su propia línea.
      for (const item of normalizedNewItems) {
        const [[linea]] = await tx.query(
          `SELECT id_detalle, cantidad
           FROM detalle_comanda
           WHERE id_pedido = ?
             AND id_platillo = ?
             AND COALESCE(nota, '') = ?
           LIMIT 1`,
          [idPedido, item.id_platillo, item.nota || ""]
        );

        if (linea) {
          await tx.query(
            `UPDATE detalle_comanda SET cantidad = ? WHERE id_detalle = ?`,
            [Number(linea.cantidad) + item.quantity, linea.id_detalle]
          );
        } else {
          await tx.query(
            `INSERT INTO detalle_comanda
             (id_pedido, id_platillo, cantidad, precio_unitario, nota)
             VALUES (?, ?, ?, ?, ?)`,
            [
              idPedido,
              item.id_platillo,
              item.quantity,
              item.price,
              item.nota || null,
            ]
          );
        }
      }

      // El total se deriva del detalle, no se calcula en JavaScript
      await recalcularTotal(idPedido, tx);

      return { message: mensaje, id_pedido: idPedido };
    });

    // La cocina es quien necesita enterarse de un pedido nuevo
    if (req.notify) {
      req.notify(["Cocina", "Admin"], "newOrder", {
        tableId,
        id_pedido: resultado.id_pedido,
      });
    }

    res.json(resultado);
  } catch (err) {
    if (err.code === "MESA_NO_EXISTE") {
      return res.status(404).json({ error: "La mesa no existe" });
    }
    console.error("createOrder error:", err);
    res.status(500).json({ error: "Error creando pedido" });
  }
};

// ============================================================
// 2. MOZO ENVÍA A CAJA
// ============================================================
exports.finishOrderForTable = async (req, res) => {
  const { tableId } = req.params;

  try {
    await db.query(
      `UPDATE pedidos SET estado='por_pagar'
       WHERE id_mesa=? AND estado IN ('pendiente','listo','servido')`,
      [tableId]
    );

    await db.query(
      `UPDATE mesa SET estado='Por pagar' WHERE id_mesa=?`,
      [tableId]
    );

    // La caja es quien debe ver la cuenta entrante
    if (req.notify) {
      req.notify(["Caja", "Admin"], "orderToCashier", {
        tableId: Number(tableId),
      });
    }

    res.json({ message: "Pedido enviado a caja" });
  } catch (err) {
    console.error("finishOrderForTable:", err);
    res.status(500).json({ error: "Error finalizando pedido" });
  }
};

// ============================================================
// 3. LISTAR PEDIDOS PARA COCINA
// ============================================================
exports.getKitchenOrders = async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.id_pedido, p.id_mesa, p.estado, p.fecha_creacion, m.numero_mesa
       FROM pedidos p
       JOIN mesa m ON p.id_mesa = m.id_mesa
       WHERE p.estado = 'pendiente'
       ORDER BY p.fecha_creacion ASC`
    );

    // Una sola consulta para el detalle de todos los pedidos
    const detallePorPedido = await obtenerItemsDeVarios(
      rows.map((p) => p.id_pedido)
    );

    const pedidos = rows.map((p) => ({
      id_pedido: p.id_pedido,
      id_mesa: p.id_mesa,
      numero_mesa: p.numero_mesa,
      fecha_creacion: p.fecha_creacion,
      estado: p.estado,
      items: detallePorPedido[p.id_pedido] || [],
    }));

    res.json(pedidos);
  } catch (err) {
    console.error("getKitchenOrders:", err);
    res.status(500).json({ error: "Error obteniendo pedidos para cocina" });
  }
};

// ============================================================
// 4. MARCAR PEDIDO COMO LISTO
// ============================================================
exports.markOrderAsReady = async (req, res) => {
  const { id } = req.params;

  try {
    const [[pedido]] = await db.query(
      "SELECT id_mesa FROM pedidos WHERE id_pedido = ?",
      [id]
    );

    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    await db.query(
      "UPDATE pedidos SET estado = 'listo' WHERE id_pedido = ?",
      [id]
    );

    if (req.notify) {
      req.notify(["Mozo", "Admin"], "orderReady", {
        tableId: pedido.id_mesa,
        id_pedido: Number(id),
      });
    }

    res.json({ message: "Pedido marcado como listo" });
  } catch (err) {
    console.error("markOrderAsReady:", err);
    res.status(500).json({ error: "Error al marcar pedido como listo" });
  }
};

// ============================================================
// 4b. MARCAR COMO SERVIDO (MOZO)
//     Cierra el circuito: cocina lo deja listo, el mozo confirma
//     que lo entregó en la mesa. Antes este estado existía en la
//     base pero nadie lo usaba.
// ============================================================
exports.markOrderAsServed = async (req, res) => {
  const { id } = req.params;

  try {
    const [[pedido]] = await db.query(
      "SELECT id_mesa, estado FROM pedidos WHERE id_pedido = ?",
      [id]
    );

    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    if (pedido.estado !== "listo") {
      return res.status(409).json({
        error: `Solo se puede servir un pedido que esté 'listo' (está '${pedido.estado}')`,
      });
    }

    await db.query(
      "UPDATE pedidos SET estado = 'servido', fecha_servido = NOW() WHERE id_pedido = ?",
      [id]
    );

    if (req.notify) {
      req.notify(["Cocina", "Admin"], "orderServed", {
        tableId: pedido.id_mesa,
        id_pedido: Number(id),
      });
    }

    res.json({ message: "Pedido marcado como servido" });
  } catch (err) {
    console.error("markOrderAsServed:", err);
    res.status(500).json({ error: "Error al marcar el pedido como servido" });
  }
};

// ============================================================
// 5. ANULAR PEDIDO
//    Solo antes de cobrarlo. Un pedido pagado se revierte desde
//    caja (anulación de comprobante), no desde aquí.
// ============================================================
exports.cancelOrder = async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body;

  if (!motivo || String(motivo).trim().length < 3) {
    return res
      .status(400)
      .json({ error: "Debes indicar el motivo de la anulación" });
  }

  try {
    const resultado = await db.withTransaction(async (tx) => {
      const [[pedido]] = await tx.query(
        `SELECT id_pedido, id_mesa, estado
         FROM pedidos
         WHERE id_pedido = ?
         FOR UPDATE`,
        [id]
      );

      if (!pedido) {
        const err = new Error("NO_EXISTE");
        err.code = "NO_EXISTE";
        throw err;
      }

      if (pedido.estado === "pagado") {
        const err = new Error("YA_PAGADO");
        err.code = "YA_PAGADO";
        throw err;
      }

      if (pedido.estado === "anulado") {
        const err = new Error("YA_ANULADO");
        err.code = "YA_ANULADO";
        throw err;
      }

      await tx.query(
        `UPDATE pedidos
         SET estado = 'anulado',
             motivo_anulacion = ?,
             anulado_por = ?
         WHERE id_pedido = ?`,
        [String(motivo).trim(), req.user.id, id]
      );

      // Si a la mesa no le queda ningún pedido abierto, se libera
      const [[abiertos]] = await tx.query(
        `SELECT COUNT(*) AS n
         FROM pedidos
         WHERE id_mesa = ?
           AND estado IN ('pendiente', 'listo', 'servido', 'por_pagar')`,
        [pedido.id_mesa]
      );

      if (Number(abiertos.n) === 0) {
        await tx.query(
          `UPDATE mesa
           SET estado = 'Disponible', id_personal_asignado = NULL
           WHERE id_mesa = ?`,
          [pedido.id_mesa]
        );
      }

      return { id_mesa: pedido.id_mesa, liberada: Number(abiertos.n) === 0 };
    });

    // Todos los roles operativos deben refrescar su vista
    if (req.notify) {
      req.notify(["Mozo", "Cocina", "Caja", "Admin"], "orderCancelled", {
        tableId: resultado.id_mesa,
        id_pedido: Number(id),
      });
    }

    res.json({
      message: "Pedido anulado",
      mesa_liberada: resultado.liberada,
    });
  } catch (err) {
    if (err.code === "NO_EXISTE") {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }
    if (err.code === "YA_PAGADO") {
      return res.status(409).json({
        error:
          "El pedido ya fue cobrado. Debe anularse el comprobante desde caja.",
      });
    }
    if (err.code === "YA_ANULADO") {
      return res.status(409).json({ error: "El pedido ya estaba anulado" });
    }
    console.error("cancelOrder:", err);
    res.status(500).json({ error: "Error anulando el pedido" });
  }
};

// ============================================================
// 6. GENERAR PDF
// ============================================================
exports.generateOrderPDF = async (req, res) => {
  const { id } = req.params;

  try {
    // Si el pedido ya fue cobrado, se adjuntan los datos del comprobante
    // (boleta/factura) y del pago para emitir el documento completo.
    const [[pedido]] = await db.query(
      `SELECT p.*, m.numero_mesa,
              per.nombre AS nombre_mozo,
              per.apellido AS apellido_mozo,
              cp.tipo_comprobante,
              cp.numero_comprobante,
              pg.metodo_pago
       FROM pedidos p
       JOIN mesa m ON p.id_mesa = m.id_mesa
       JOIN personal per ON p.id_personal = per.id_personal
       LEFT JOIN pago pg ON pg.id_pago = p.id_pago
       LEFT JOIN comprobante_pago cp ON cp.id_pago = p.id_pago
       WHERE p.id_pedido = ?`,
      [id]
    );

    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    const items = await obtenerItems(pedido.id_pedido);

    const order = {
      id_pedido: pedido.id_pedido,
      id_mesa: pedido.id_mesa,
      nombre_mesa: `Mesa ${pedido.numero_mesa}`,
      mozo: `${pedido.nombre_mozo} ${pedido.apellido_mozo}`,
      fecha_creacion: pedido.fecha_creacion,
      items,
      total: pedido.total,
      descuento: pedido.descuento,
      propina: pedido.propina,
      // Datos de comprobante (null si aún no se ha cobrado)
      tipo_comprobante: pedido.tipo_comprobante,
      numero_comprobante: pedido.numero_comprobante,
      nombre_cliente: pedido.nombre_cliente,
      doc_cliente: pedido.doc_cliente,
      metodo_pago: pedido.metodo_pago,
    };

    const nombreArchivo = pedido.numero_comprobante
      ? `${pedido.numero_comprobante}.pdf`
      : `pedido_${pedido.id_pedido}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${nombreArchivo}"`);

    streamOrderPDF(order, res);
  } catch (err) {
    console.error("generateOrderPDF:", err);
    res.status(500).json({ error: "Error generando PDF" });
  }
};
