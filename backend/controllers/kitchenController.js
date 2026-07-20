// backend/controllers/kitchenController.js
const db = require("../config/db");
const { obtenerItemsDeVarios } = require("../utils/pedidoItems");

// ======================= PEDIDOS PENDIENTES =======================
exports.getPendingOrders = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        p.id_pedido,
        p.id_mesa,
        m.numero_mesa,
        p.total,
        p.estado,
        p.fecha_creacion
      FROM pedidos p
      JOIN mesa m ON m.id_mesa = p.id_mesa
      WHERE p.estado = 'pendiente'
      ORDER BY p.fecha_creacion ASC
    `);

    // El detalle ya no se parsea de un JSON: son filas con FK a platillo
    const detallePorPedido = await obtenerItemsDeVarios(
      rows.map((r) => r.id_pedido)
    );

    const pedidos = rows.map(r => ({
      id_pedido: r.id_pedido,
      id_mesa: r.id_mesa,
      mesa: r.numero_mesa,
      total: Number(r.total || 0),
      estado: r.estado,
      items: detallePorPedido[r.id_pedido] || [],
      fecha_creacion: r.fecha_creacion
    }));

    res.json(pedidos);

  } catch (err) {
    console.error("getPendingOrders:", err);
    res.status(500).json({ error: "Error obteniendo pedidos" });
  }
};

// ======================= MARCAR PEDIDO LISTO =======================
exports.markOrderReady = async (req, res) => {
  const { id } = req.params;

  try {
    const [[pedido]] = await db.query(
      `SELECT id_mesa FROM pedidos WHERE id_pedido = ?`,
      [id]
    );

    if (!pedido) {
      return res.status(404).json({ error: "Pedido no encontrado" });
    }

    await db.query(
      `UPDATE pedidos SET estado = 'listo' WHERE id_pedido = ?`,
      [id]
    );

    // Mesa sigue ocupada
    await db.query(
      `UPDATE mesa SET estado = 'Ocupada' WHERE id_mesa = ?`,
      [pedido.id_mesa]
    );

    // Solo al mozo (y al admin) le interesa que un plato esté listo
    if (req.notify) {
      req.notify(["Mozo", "Admin"], "orderReady", {
        tableId: pedido.id_mesa,
        orderId: Number(id),
      });
      req.notify(["Mozo", "Caja", "Admin"], "tables_update", {});
    }

    res.json({ message: "Pedido marcado como listo" });

  } catch (err) {
    console.error("markOrderReady:", err);
    res.status(500).json({ error: "Error marcando pedido como listo" });
  }
};
