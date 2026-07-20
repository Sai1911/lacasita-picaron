// backend/controllers/menuController.js
const db = require("../config/db");

// Obtener menú (solo platillos disponibles)
exports.getMenu = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        id_platillo AS id,
        nombre AS name,
        descripcion AS description,
        categoria AS category,
        precio AS price,
        disponibilidad
      FROM platillo
      ORDER BY id_platillo DESC
    `);
  res.json(rows);
  } catch (err) {
    console.error("Error getMenu:", err);
    res.status(500).json({ error: "Error al obtener el menú" });
  }
};

// Categorías válidas (deben coincidir con el CHECK de la tabla platillo)
const CATEGORIAS_VALIDAS = [
  "Calientes",
  "Frias",
  "Parrilla",
  "Entradas",
  "Postres",
  "Bebidas",
];

// Agregar platillo
// Acepta tanto {nombre, descripcion, categoria, precio} como
// {name, description, category, price} (el panel de Admin usa el segundo).
exports.addMenuItem = async (req, res) => {
  const nombre = req.body.nombre ?? req.body.name;
  const descripcion = req.body.descripcion ?? req.body.description ?? "";
  const categoria = req.body.categoria ?? req.body.category;
  const precio = req.body.precio ?? req.body.price;

  if (!nombre || !categoria || precio === undefined || precio === null) {
    return res
      .status(400)
      .json({ error: "Faltan datos: nombre, categoría y precio son obligatorios" });
  }

  if (!CATEGORIAS_VALIDAS.includes(categoria)) {
    return res.status(400).json({
      error: `Categoría inválida: "${categoria}"`,
      categoriasValidas: CATEGORIAS_VALIDAS,
    });
  }

  try {
    await db.query(
      `INSERT INTO platillo (nombre, descripcion, categoria, precio, disponibilidad)
       VALUES (?, ?, ?, ?, 1)`,
      [nombre, descripcion, categoria, Number(precio)]
    );

    res.json({ message: "Platillo creado" });
  } catch (err) {
    console.error("addMenuItem:", err);
    res.status(500).json({ error: "Error al crear platillo" });
  }
};

// Cambiar disponibilidad
exports.toggleAvailability = async (req, res) => {
  const { id } = req.params;

  try {
    const [[item]] = await db.query(
      "SELECT disponibilidad FROM platillo WHERE id_platillo=?",
      [id]
    );

    if (!item) return res.status(404).json({ error: "Platillo no encontrado" });

    const nuevo = item.disponibilidad === 1 ? 0 : 1;

    await db.query(
      "UPDATE platillo SET disponibilidad=? WHERE id_platillo=?",
      [nuevo, id]
    );

    res.json({ message: "Disponibilidad actualizada", disponibilidad: nuevo });
  } catch (err) {
    console.error("toggleAvailability:", err);
    res.status(500).json({ error: "Error al cambiar disponibilidad" });
  }
};
