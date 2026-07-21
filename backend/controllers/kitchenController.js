// backend/controllers/kitchenController.js
const db = require("../config/db");

// ======================= PEDIDOS PENDIENTES =======================
// Cocina ve las cuentas que tengan al menos una línea por preparar,
// y de cada una SOLO las líneas pendientes. Así, cuando el mozo añade
// platillos a una mesa que ya recibió comida, cocina recibe únicamente
// lo nuevo y no vuelve a preparar lo ya servido.
exports.getPendingOrders = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        p.id_pedido,
        p.id_mesa,
        m.numero_mesa,
        p.estado,
        -- El tiempo de espera se mide desde el platillo pendiente más
        -- antiguo, no desde la creación de la cuenta.
        MIN(d.id_detalle)            AS primera_linea,
        p.fecha_creacion,
        SUM(d.cantidad * d.precio_unitario) AS total_pendiente
      FROM pedidos p
      JOIN mesa m            ON m.id_mesa = p.id_mesa
      JOIN detalle_comanda d ON d.id_pedido = p.id_pedido
      WHERE p.estado IN ('pendiente', 'listo', 'servido', 'por_pagar')
        AND d.estado = 'pendiente'
      GROUP BY p.id_pedido, p.id_mesa, m.numero_mesa, p.estado, p.fecha_creacion
      ORDER BY p.fecha_creacion ASC
    `);

    if (!rows.length) return res.json([]);

    // Detalle pendiente de todas esas cuentas en una sola consulta
    const ids = rows.map((r) => r.id_pedido);
    const marcadores = ids.map(() => "?").join(",");

    const [lineas] = await db.query(
      `SELECT d.id_pedido, d.id_detalle, d.id_platillo, d.cantidad,
              d.precio_unitario, d.nota, pl.nombre
       FROM detalle_comanda d
       JOIN platillo pl ON pl.id_platillo = d.id_platillo
       WHERE d.id_pedido IN (${marcadores})
         AND d.estado = 'pendiente'
       ORDER BY d.id_pedido, d.id_detalle`,
      ids
    );

    const porPedido = lineas.reduce((acc, r) => {
      (acc[r.id_pedido] ??= []).push({
        id_detalle: r.id_detalle,
        id_platillo: r.id_platillo,
        name: r.nombre,
        price: Number(r.precio_unitario),
        quantity: Number(r.cantidad),
        nota: r.nota || "",
      });
      return acc;
    }, {});

    const pedidos = rows.map((r) => ({
      id_pedido: r.id_pedido,
      id_mesa: r.id_mesa,
      mesa: r.numero_mesa,
      total: Number(r.total_pendiente || 0),
      estado: r.estado,
      items: porPedido[r.id_pedido] || [],
      fecha_creacion: r.fecha_creacion,
    }));

    res.json(pedidos);
  } catch (err) {
    console.error("getPendingOrders:", err);
    res.status(500).json({ error: "Error obteniendo pedidos" });
  }
};

// ======================= MARCAR PEDIDO LISTO =======================
// Marca como listas únicamente las líneas pendientes de esa cuenta.
// La cabecera pasa a 'listo' solo si no queda nada por preparar.
exports.markOrderReady = async (req, res) => {
  const { id } = req.params;

  try {
    const resultado = await db.withTransaction(async (tx) => {
      const [[pedido]] = await tx.query(
        `SELECT id_mesa, estado FROM pedidos WHERE id_pedido = ? FOR UPDATE`,
        [id]
      );

      if (!pedido) {
        const err = new Error("NO_EXISTE");
        err.code = "NO_EXISTE";
        throw err;
      }

      const [marcadas] = await tx.query(
        `UPDATE detalle_comanda
         SET estado = 'listo', fecha_listo = NOW()
         WHERE id_pedido = ? AND estado = 'pendiente'`,
        [id]
      );

      if (!marcadas.affectedRows) {
        const err = new Error("SIN_PENDIENTES");
        err.code = "SIN_PENDIENTES";
        throw err;
      }

      // Si la cuenta ya estaba enviada a caja, no se retrocede su estado.
      if (pedido.estado === "pendiente") {
        await tx.query(
          `UPDATE pedidos SET estado = 'listo' WHERE id_pedido = ?`,
          [id]
        );
      }

      return { id_mesa: pedido.id_mesa };
    });

    if (req.notify) {
      req.notify(["Mozo", "Admin"], "orderReady", {
        tableId: resultado.id_mesa,
        orderId: Number(id),
      });
      req.notify(["Mozo", "Caja", "Admin"], "tables_update", {});
    }

    res.json({ message: "Pedido marcado como listo" });
  } catch (err) {
    if (err.code === "NO_EXISTE") {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }
    if (err.code === "SIN_PENDIENTES") {
      return res
        .status(409)
        .json({ error: "Este pedido ya no tiene platillos por preparar" });
    }
    console.error("markOrderReady:", err);
    res.status(500).json({ error: "Error marcando pedido como listo" });
  }
};
