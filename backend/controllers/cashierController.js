const db = require("../config/db");
const { siguienteNumero } = require("../utils/comprobante");
const { calcularMontoCobrado } = require("../utils/calculos");

// Busca el cliente por su documento y lo crea si no existe.
// Así los datos del cliente dejan de repetirse en cada pedido:
// un cliente recurrente queda registrado una sola vez.
async function obtenerOCrearCliente(tx, nombre, documento) {
  if (!documento) return null;

  const [[existente]] = await tx.query(
    `SELECT id_cliente FROM cliente WHERE dni_ruc = ?`,
    [documento]
  );

  if (existente) {
    // Se actualiza el nombre por si llegó más completo esta vez
    if (nombre) {
      await tx.query(`UPDATE cliente SET nombre = ? WHERE id_cliente = ?`, [
        nombre,
        existente.id_cliente,
      ]);
    }
    return existente.id_cliente;
  }

  const [nuevo] = await tx.query(
    `INSERT INTO cliente (nombre, dni_ruc) VALUES (?, ?)`,
    [nombre || "Cliente", documento]
  );

  return nuevo.insertId;
}

// Devuelve la caja abierta actualmente, o null.
async function obtenerCajaAbierta(conn = db) {
  const [rows] = await conn.query(
    `SELECT id_caja, nombre_caja, turno, saldo_inicial, fecha_apertura
     FROM caja
     WHERE estado = 'Abierta'
     ORDER BY fecha_apertura DESC
     LIMIT 1`
  );
  return rows[0] || null;
}

// ============================================================
// 1. PEDIDOS PENDIENTES DE COBRO
// ============================================================
exports.getOrdersToPay = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT id_pedido, id_mesa, total, fecha_creacion,
             nombre_cliente, doc_cliente, tipo_doc
      FROM pedidos
      WHERE estado = 'por_pagar'
      ORDER BY fecha_creacion ASC
    `);

    res.json(rows);
  } catch (err) {
    console.error("getOrdersToPay:", err);
    res.status(500).json({ error: "Error obteniendo pedidos" });
  }
};

// ============================================================
// 2. COBRAR PEDIDO  (transaccional)
//    Registra pago → emite comprobante → marca pedido pagado
//    → libera la mesa. Todo o nada.
// ============================================================
exports.payOrder = async (req, res) => {
  const { id } = req.params;
  const {
    metodo_pago,
    tipo_comprobante = "boleta",
    nombre_cliente,
    doc_cliente,
    descuento = 0,
    propina = 0,
  } = req.body;

  if (!metodo_pago) {
    return res.status(400).json({ error: "Falta el método de pago" });
  }

  if (isNaN(Number(descuento)) || Number(descuento) < 0) {
    return res.status(400).json({ error: "El descuento no es válido" });
  }

  if (isNaN(Number(propina)) || Number(propina) < 0) {
    return res.status(400).json({ error: "La propina no es válida" });
  }

  if (!["boleta", "factura"].includes(tipo_comprobante)) {
    return res
      .status(400)
      .json({ error: "El comprobante debe ser 'boleta' o 'factura'" });
  }

  // Una factura exige RUC de 11 dígitos; la boleta admite DNI opcional.
  if (tipo_comprobante === "factura") {
    if (!doc_cliente || !/^\d{11}$/.test(String(doc_cliente))) {
      return res.status(400).json({
        error: "Para emitir una factura se requiere un RUC válido de 11 dígitos",
      });
    }
    if (!nombre_cliente) {
      return res
        .status(400)
        .json({ error: "Para emitir una factura se requiere la razón social" });
    }
  }

  if (
    tipo_comprobante === "boleta" &&
    doc_cliente &&
    !/^\d{8}$/.test(String(doc_cliente))
  ) {
    return res
      .status(400)
      .json({ error: "El DNI debe tener 8 dígitos" });
  }

  try {
    // El cobro debe registrarse contra un turno de caja abierto.
    const caja = await obtenerCajaAbierta();
    if (!caja) {
      return res.status(409).json({
        error: "No hay una caja aperturada. Apertura la caja antes de cobrar.",
      });
    }

    const resultado = await db.withTransaction(async (tx) => {
      // Se relee el pedido dentro de la transacción y se bloquea la fila,
      // para que dos cajeros no puedan cobrarlo a la vez.
      const [[pedido]] = await tx.query(
        `SELECT id_pedido, id_mesa, total
         FROM pedidos
         WHERE id_pedido = ? AND estado = 'por_pagar'
         FOR UPDATE`,
        [id]
      );

      if (!pedido) {
        const err = new Error("PEDIDO_NO_DISPONIBLE");
        err.code = "PEDIDO_NO_DISPONIBLE";
        throw err;
      }

      // Importe realmente cobrado = consumo - descuento + propina
      const subtotal = Number(pedido.total);
      const desc = Number(descuento);
      const prop = Number(propina);

      let montoCobrado;
      try {
        montoCobrado = calcularMontoCobrado(subtotal, desc, prop);
      } catch {
        const err = new Error("DESCUENTO_EXCESIVO");
        err.code = "DESCUENTO_EXCESIVO";
        throw err;
      }

      // 1) Registrar el pago, ligado al turno de caja
      const [pago] = await tx.query(
        `INSERT INTO pago (monto_total, metodo_pago, fecha_pago, id_caja)
         VALUES (?, ?, NOW(), ?)`,
        [montoCobrado, metodo_pago, caja.id_caja]
      );
      const idPago = pago.insertId;

      // 2) Emitir el comprobante con correlativo propio de la serie
      const [[ultimo]] = await tx.query(
        `SELECT numero_comprobante
         FROM comprobante_pago
         WHERE tipo_comprobante = ?
         ORDER BY id_comprobante DESC
         LIMIT 1`,
        [tipo_comprobante]
      );

      const numero = siguienteNumero(ultimo?.numero_comprobante, tipo_comprobante);

      await tx.query(
        `INSERT INTO comprobante_pago
         (tipo_comprobante, numero_comprobante, fecha_emision, id_pago)
         VALUES (?, ?, NOW(), ?)`,
        [tipo_comprobante, numero, idPago]
      );

      // 3) Marcar el pedido como pagado y guardar los datos del cliente
      // El cliente se normaliza en su propia tabla
      const idCliente = await obtenerOCrearCliente(
        tx,
        nombre_cliente,
        doc_cliente
      );

      await tx.query(
        `UPDATE pedidos
         SET estado = 'pagado',
             id_pago = ?,
             id_cliente = ?,
             tipo_doc = ?,
             nombre_cliente = ?,
             doc_cliente = ?,
             descuento = ?,
             propina = ?
         WHERE id_pedido = ?`,
        [
          idPago,
          idCliente,
          tipo_comprobante,
          nombre_cliente || null,
          doc_cliente || null,
          desc,
          prop,
          id,
        ]
      );

      // 4) Liberar la mesa
      // Al liberarse, la mesa deja de estar asignada a ningún mozo
      await tx.query(
        `UPDATE mesa
         SET estado = 'Disponible', id_personal_asignado = NULL
         WHERE id_mesa = ?`,
        [pedido.id_mesa]
      );

      return {
        id_mesa: pedido.id_mesa,
        id_pago: idPago,
        numero_comprobante: numero,
        subtotal,
        descuento: desc,
        propina: prop,
        monto_cobrado: montoCobrado,
      };
    });

    // El mozo necesita ver que su mesa quedó libre
    if (req.notify) {
      req.notify(["Mozo", "Admin"], "orderPaid", { tableId: resultado.id_mesa });
    }

    res.json({
      message: "Pago registrado y mesa liberada",
      id_pago: resultado.id_pago,
      tipo_comprobante,
      numero_comprobante: resultado.numero_comprobante,
      subtotal: resultado.subtotal,
      descuento: resultado.descuento,
      propina: resultado.propina,
      monto_cobrado: resultado.monto_cobrado,
    });
  } catch (err) {
    if (err.code === "PEDIDO_NO_DISPONIBLE") {
      return res
        .status(404)
        .json({ error: "El pedido no existe o ya fue cobrado" });
    }
    if (err.code === "DESCUENTO_EXCESIVO") {
      return res
        .status(400)
        .json({ error: "El descuento no puede superar el total del pedido" });
    }
    console.error("payOrder:", err);
    res.status(500).json({ error: "Error registrando pago" });
  }
};

// ============================================================
// 3. ANULAR COBRO (comprobante emitido por error)
//    El pago y el comprobante NO se borran: se marcan como anulados
//    para conservar la trazabilidad y el correlativo. El pedido
//    vuelve a "por_pagar" para poder cobrarlo correctamente.
// ============================================================
exports.anularCobro = async (req, res) => {
  const { id } = req.params; // id_pedido
  const { motivo } = req.body;

  if (!motivo || String(motivo).trim().length < 3) {
    return res
      .status(400)
      .json({ error: "Debes indicar el motivo de la anulación" });
  }

  try {
    const resultado = await db.withTransaction(async (tx) => {
      const [[pedido]] = await tx.query(
        `SELECT id_pedido, id_mesa, id_pago, estado
         FROM pedidos
         WHERE id_pedido = ?
         FOR UPDATE`,
        [id]
      );

      if (!pedido || pedido.estado !== "pagado" || !pedido.id_pago) {
        const err = new Error("NO_ANULABLE");
        err.code = "NO_ANULABLE";
        throw err;
      }

      // Solo se puede anular mientras la caja del cobro siga abierta:
      // si ya se cerró, el arqueo está firmado y cuadrado.
      const [[pago]] = await tx.query(
        `SELECT p.id_pago, p.id_caja, c.estado AS estado_caja
         FROM pago p
         LEFT JOIN caja c ON c.id_caja = p.id_caja
         WHERE p.id_pago = ?`,
        [pedido.id_pago]
      );

      if (pago?.estado_caja !== "Abierta") {
        const err = new Error("CAJA_CERRADA");
        err.code = "CAJA_CERRADA";
        throw err;
      }

      await tx.query(
        `UPDATE pago
         SET estado = 'anulado',
             motivo_anulacion = ?,
             fecha_anulacion = NOW()
         WHERE id_pago = ?`,
        [String(motivo).trim(), pedido.id_pago]
      );

      await tx.query(
        `UPDATE comprobante_pago SET estado = 'anulado' WHERE id_pago = ?`,
        [pedido.id_pago]
      );

      // El pedido vuelve a estar pendiente de cobro
      await tx.query(
        `UPDATE pedidos
         SET estado = 'por_pagar', id_pago = NULL
         WHERE id_pedido = ?`,
        [id]
      );

      await tx.query(`UPDATE mesa SET estado = 'Por pagar' WHERE id_mesa = ?`, [
        pedido.id_mesa,
      ]);

      return { id_mesa: pedido.id_mesa };
    });

    if (req.notify) {
      req.notify(["Mozo", "Caja", "Admin"], "paymentCancelled", {
        tableId: resultado.id_mesa,
        id_pedido: Number(id),
      });
    }

    res.json({
      message:
        "Cobro anulado. El comprobante queda registrado como anulado y el pedido vuelve a caja.",
    });
  } catch (err) {
    if (err.code === "NO_ANULABLE") {
      return res
        .status(409)
        .json({ error: "El pedido no está cobrado o no tiene pago asociado" });
    }
    if (err.code === "CAJA_CERRADA") {
      return res.status(409).json({
        error:
          "No se puede anular: la caja de ese cobro ya fue cerrada y el arqueo está cuadrado.",
      });
    }
    console.error("anularCobro:", err);
    res.status(500).json({ error: "Error anulando el cobro" });
  }
};

// ============================================================
// 4. CAJA: estado actual
// ============================================================
exports.getCajaActual = async (req, res) => {
  try {
    const caja = await obtenerCajaAbierta();

    if (!caja) return res.json({ abierta: false, caja: null });

    // Totales acumulados en el turno en curso
    // Los cobros anulados no cuentan para el arqueo
    const [[resumen]] = await db.query(
      `SELECT COALESCE(SUM(monto_total), 0) AS total_ingresos,
              COUNT(*)                     AS cantidad_pagos
       FROM pago
       WHERE id_caja = ? AND estado = 'activo'`,
      [caja.id_caja]
    );

    res.json({
      abierta: true,
      caja: {
        ...caja,
        saldo_inicial: Number(caja.saldo_inicial),
        total_ingresos: Number(resumen.total_ingresos),
        cantidad_pagos: Number(resumen.cantidad_pagos),
      },
    });
  } catch (err) {
    console.error("getCajaActual:", err);
    res.status(500).json({ error: "Error obteniendo el estado de la caja" });
  }
};

// ============================================================
// 4. CAJA: apertura de turno
// ============================================================
exports.abrirCaja = async (req, res) => {
  const { nombre_caja, turno, saldo_inicial } = req.body;

  if (!nombre_caja || saldo_inicial === undefined || saldo_inicial === null) {
    return res
      .status(400)
      .json({ error: "Se requiere el nombre de caja y el saldo inicial" });
  }

  if (isNaN(Number(saldo_inicial)) || Number(saldo_inicial) < 0) {
    return res.status(400).json({ error: "El saldo inicial no es válido" });
  }

  try {
    const yaAbierta = await obtenerCajaAbierta();
    if (yaAbierta) {
      return res.status(409).json({
        error: `Ya existe una caja aperturada (${yaAbierta.nombre_caja}). Ciérrala antes de abrir otra.`,
      });
    }

    const [result] = await db.query(
      `INSERT INTO caja (nombre_caja, turno, estado, saldo_inicial, fecha_apertura)
       VALUES (?, ?, 'Abierta', ?, NOW())`,
      [nombre_caja, turno || null, Number(saldo_inicial)]
    );

    res.json({
      message: "Caja aperturada correctamente",
      id_caja: result.insertId,
    });
  } catch (err) {
    console.error("abrirCaja:", err);
    res.status(500).json({ error: "Error aperturando la caja" });
  }
};

// ============================================================
// 5. CAJA: cierre de turno (arqueo)
//    saldo_final = saldo_inicial + ingresos - egresos
// ============================================================
exports.cerrarCaja = async (req, res) => {
  const { observacion, total_egresos = 0 } = req.body;

  if (isNaN(Number(total_egresos)) || Number(total_egresos) < 0) {
    return res.status(400).json({ error: "El monto de egresos no es válido" });
  }

  try {
    const caja = await obtenerCajaAbierta();
    if (!caja) {
      return res.status(409).json({ error: "No hay ninguna caja aperturada" });
    }

    const resultado = await db.withTransaction(async (tx) => {
      // Los cobros anulados no cuentan para el arqueo
      const [[resumen]] = await tx.query(
        `SELECT COALESCE(SUM(monto_total), 0) AS total_ingresos
         FROM pago
         WHERE id_caja = ? AND estado = 'activo'`,
        [caja.id_caja]
      );

      const ingresos = Number(resumen.total_ingresos);
      const egresos = Number(total_egresos);
      const saldoFinal = Number(caja.saldo_inicial) + ingresos - egresos;

      const [reporte] = await tx.query(
        `INSERT INTO reportecierre
         (id_personal, id_caja, fecha_cierre, total_ingresos, total_egresos, saldo_final, observacion)
         VALUES (?, ?, NOW(), ?, ?, ?, ?)`,
        [
          req.user.id,
          caja.id_caja,
          ingresos,
          egresos,
          saldoFinal,
          observacion || null,
        ]
      );

      await tx.query(`UPDATE caja SET estado = 'Cerrada' WHERE id_caja = ?`, [
        caja.id_caja,
      ]);

      return {
        id_reporte: reporte.insertId,
        saldo_inicial: Number(caja.saldo_inicial),
        total_ingresos: ingresos,
        total_egresos: egresos,
        saldo_final: saldoFinal,
      };
    });

    res.json({ message: "Caja cerrada correctamente", ...resultado });
  } catch (err) {
    console.error("cerrarCaja:", err);
    res.status(500).json({ error: "Error cerrando la caja" });
  }
};

// ============================================================
// 6. CAJA: historial de cierres
// ============================================================
exports.getCierres = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT r.id_reporte,
             r.fecha_cierre,
             r.total_ingresos,
             r.total_egresos,
             r.saldo_final,
             r.observacion,
             c.nombre_caja,
             c.turno,
             p.nombre  AS nombre_cajero,
             p.apellido AS apellido_cajero
      FROM reportecierre r
      JOIN caja c     ON c.id_caja = r.id_caja
      JOIN personal p ON p.id_personal = r.id_personal
      ORDER BY r.fecha_cierre DESC
      LIMIT 50
    `);

    res.json(rows);
  } catch (err) {
    console.error("getCierres:", err);
    res.status(500).json({ error: "Error obteniendo los cierres de caja" });
  }
};
