// backend/controllers/tablesController.js
const db = require("../config/db");
const { obtenerItems } = require("../utils/pedidoItems");

// ===============================
// 1. LISTAR MESAS
// ===============================
exports.getTables = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT m.id_mesa,
             m.numero_mesa,
             m.estado,
             m.id_personal_asignado,
             p.nombre AS mozo_asignado
      FROM mesa m
      LEFT JOIN personal p ON p.id_personal = m.id_personal_asignado
      ORDER BY m.numero_mesa::int
    `);

    res.json(rows);
  } catch (err) {
    console.error("getTables:", err);
    res.status(500).json({ error: "Error obteniendo mesas" });
  }
};

// ===============================
// 2. PEDIDO ACTUAL POR MESA
// ===============================
exports.getCurrentOrderByTable = async (req, res) => {
  const { id } = req.params;

  try {
    const [rows] = await db.query(
      `
      SELECT *
      FROM pedidos
      WHERE id_mesa = ?
        AND estado IN ('pendiente', 'listo', 'servido', 'por_pagar')
      ORDER BY fecha_creacion DESC
      LIMIT 1
      `,
      [id]
    );

    if (rows.length === 0) {
      return res.json(null);
    }

    const pedido = rows[0];
    const items = await obtenerItems(pedido.id_pedido);

    res.json({
      id_pedido: pedido.id_pedido,
      total: Number(pedido.total || 0),
      estado: pedido.estado,
      items,
      fecha_creacion: pedido.fecha_creacion,
    });
  } catch (err) {
    console.error("getCurrentOrderByTable:", err);
    res.status(500).json({ error: "Error obteniendo pedido" });
  }
};
