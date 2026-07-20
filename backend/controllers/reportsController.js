const db = require("../config/db");

// ===============================
// 1. REPORTE DIARIO
// ===============================
exports.getDailyReport = async (req, res) => {
  const { date } = req.query;

  if (!date) return res.status(400).json({ error: "Falta parámetro 'date'" });

  try {
    const [rows] = await db.query(
      `SELECT monto_total, metodo_pago, fecha_pago
       FROM pago
       WHERE estado = 'activo' AND fecha_pago::date = ?`,
      [date]
    );

    const total = rows.reduce((acc, r) => acc + Number(r.monto_total), 0);

    res.json({
      date,
      total,
      pagos: rows,
    });
  } catch (err) {
    console.error("Error getDailyReport:", err);
    res.status(500).json({ error: "Error obteniendo reporte diario" });
  }
};

// ===============================
// 2. REPORTE POR RANGO DE FECHAS
// ===============================
exports.getRangeReport = async (req, res) => {
  const { from, to } = req.query;

  if (!from || !to)
    return res.status(400).json({ error: "Faltan parámetros 'from' y 'to'" });

  try {
    const [rows] = await db.query(
      `SELECT monto_total, metodo_pago, fecha_pago
       FROM pago
       WHERE estado = 'activo' AND fecha_pago::date BETWEEN ? AND ?`,
      [from, to]
    );

    const total = rows.reduce((acc, r) => acc + Number(r.monto_total), 0);

    res.json({
      from,
      to,
      total,
      pagos: rows,
    });
  } catch (err) {
    console.error("Error getRangeReport:", err);
    res.status(500).json({ error: "Error obteniendo reporte por rango" });
  }
};

// ===============================
// 3. REPORTE MENSUAL
// ===============================
exports.getMonthlyReport = async (req, res) => {
  const { month, year } = req.query;

  if (!month || !year)
    return res.status(400).json({ error: "Faltan parámetros 'month' y 'year'" });

  try {
    const [rows] = await db.query(
      `SELECT fecha_pago::date AS dia, SUM(monto_total) AS total
       FROM pago
       WHERE estado = 'activo' AND EXTRACT(MONTH FROM fecha_pago) = ? AND EXTRACT(YEAR FROM fecha_pago) = ?
       GROUP BY fecha_pago::date
       ORDER BY dia ASC`,
      [month, year]
    );

    const totalMes = rows.reduce((acc, r) => acc + Number(r.total), 0);

    res.json({
      month,
      year,
      totalMes,
      detalle: rows,
    });
  } catch (err) {
    console.error("Error getMonthlyReport:", err);
    res.status(500).json({ error: "Error obteniendo reporte mensual" });
  }
};

// ===============================
// 4. REPORTE ANUAL
// ===============================
exports.getYearlyReport = async (req, res) => {
  const { year } = req.query;

  if (!year)
    return res.status(400).json({ error: "Falta parámetro 'year'" });

  try {
    const [rows] = await db.query(
      `SELECT EXTRACT(MONTH FROM fecha_pago) AS mes, SUM(monto_total) AS total
       FROM pago
       WHERE estado = 'activo' AND EXTRACT(YEAR FROM fecha_pago) = ?
       GROUP BY EXTRACT(MONTH FROM fecha_pago)
       ORDER BY mes ASC`,
      [year]
    );

    const totalAnual = rows.reduce((acc, r) => acc + Number(r.total), 0);

    res.json({
      year,
      totalAnual,
      detalle: rows,
    });
  } catch (err) {
    console.error("Error getYearlyReport:", err);
    res.status(500).json({ error: "Error obteniendo reporte anual" });
  }
};

// ===============================
// 5. TOP 10 PLATOS MÁS VENDIDOS
// ===============================
exports.getTopItems = async (req, res) => {
  try {
    // Antes había que desarmar el JSON de items_json y agrupar por el
    // NOMBRE guardado dentro (frágil: renombrar un plato partía la
    // estadística en dos). Ahora es un JOIN normal agrupando por id.
    const [rows] = await db.query(`
      SELECT
        pl.id_platillo,
        pl.nombre AS nombre_platillo,
        SUM(d.cantidad)                        AS cantidad_total,
        SUM(d.cantidad * d.precio_unitario)    AS ingresos
      FROM detalle_comanda d
      JOIN platillo pl ON pl.id_platillo = d.id_platillo
      JOIN pedidos  p  ON p.id_pedido    = d.id_pedido
      WHERE p.estado = 'pagado'
      GROUP BY pl.id_platillo, pl.nombre
      ORDER BY cantidad_total DESC
      LIMIT 10;
    `);

    res.json(rows);
  } catch (err) {
    console.error("Error getTopItems:", err);
    res.status(500).json({ error: "Error obteniendo ranking de platillos" });
  }
};
