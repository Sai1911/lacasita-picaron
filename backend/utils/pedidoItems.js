// backend/utils/pedidoItems.js
//
// Acceso al detalle de los pedidos, ya normalizado en detalle_comanda.
// Antes cada controller parseaba pedidos.items_json por su cuenta; ahora
// el detalle son filas reales con clave foránea a platillo.
//
// Se devuelve la misma forma que consumía el frontend
// ({ id_platillo, name, price, quantity, nota }) para no obligar a
// reescribir las pantallas.

const db = require("../config/db");

function mapearFila(r) {
  return {
    id_detalle: r.id_detalle,
    id_platillo: r.id_platillo,
    name: r.nombre,
    price: Number(r.precio_unitario),
    quantity: Number(r.cantidad),
    nota: r.nota || "",
  };
}

// Detalle de un único pedido
async function obtenerItems(idPedido, conn = db) {
  const [rows] = await conn.query(
    `SELECT d.id_detalle, d.id_platillo, d.cantidad, d.precio_unitario, d.nota,
            pl.nombre
     FROM detalle_comanda d
     JOIN platillo pl ON pl.id_platillo = d.id_platillo
     WHERE d.id_pedido = ?
     ORDER BY d.id_detalle`,
    [idPedido]
  );
  return rows.map(mapearFila);
}

// Detalle de varios pedidos a la vez, agrupado por id_pedido.
// Evita el problema N+1 en las listas (cocina, caja).
async function obtenerItemsDeVarios(idsPedido, conn = db) {
  if (!idsPedido.length) return {};

  const marcadores = idsPedido.map(() => "?").join(",");
  const [rows] = await conn.query(
    `SELECT d.id_pedido, d.id_detalle, d.id_platillo, d.cantidad,
            d.precio_unitario, d.nota, pl.nombre
     FROM detalle_comanda d
     JOIN platillo pl ON pl.id_platillo = d.id_platillo
     WHERE d.id_pedido IN (${marcadores})
     ORDER BY d.id_pedido, d.id_detalle`,
    idsPedido
  );

  return rows.reduce((acc, r) => {
    (acc[r.id_pedido] ??= []).push(mapearFila(r));
    return acc;
  }, {});
}

// Recalcula y guarda el total a partir del detalle.
// La fuente de verdad es el detalle; 'pedidos.total' queda como
// copia para no recalcular en cada lectura.
async function recalcularTotal(idPedido, conn = db) {
  const [[fila]] = await conn.query(
    `SELECT COALESCE(SUM(cantidad * precio_unitario), 0) AS total
     FROM detalle_comanda
     WHERE id_pedido = ?`,
    [idPedido]
  );

  const total = Number(fila.total);

  await conn.query(`UPDATE pedidos SET total = ? WHERE id_pedido = ?`, [
    total,
    idPedido,
  ]);

  return total;
}

module.exports = { obtenerItems, obtenerItemsDeVarios, recalcularTotal };
