const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const db = require("../config/db");
const { authenticateToken } = require("../middlewares/authMiddleware");

// ⚠️ Ruta temporal para generar usuarios de prueba
// Ejecutar UNA sola vez tras el primer despliegue: GET /api/dev/seed-users
router.get("/seed-users", async (req, res) => {
  try {
    const passwordHash = await bcrypt.hash("1234", 10);

    // [nombre, apellido, dni, codigo_acceso, cargo]
    const users = [
      ["Admin", "Master", "00000000", "admin", "Admin"],
      ["Mozo", "Perez", "11111111", "mozo1", "Mozo"],
      ["Cocina", "Rojas", "22222222", "cocina1", "Cocina"],
      ["Caja", "Gomez", "33333333", "caja1", "Caja"],
    ];

    for (const [nombre, apellido, dni, codigo_acceso, cargo] of users) {
      await db.query(
        `INSERT INTO personal
         (nombre, apellido, dni, codigo_acceso, password_hash, cargo, estado)
         VALUES (?, ?, ?, ?, ?, ?, 'activo')
         ON CONFLICT (codigo_acceso) DO NOTHING`,
        [nombre, apellido, dni, codigo_acceso, passwordHash, cargo]
      );
    }

    res.send("Usuarios creados correctamente ✔ Contraseña para todos: 1234");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creando usuarios");
  }
});

// ⚠️ Datos base para operar (mesas y platillos). Ejecutar una vez: GET /api/dev/seed-data
router.get("/seed-data", async (req, res) => {
  try {
    // 10 mesas
    for (let n = 1; n <= 10; n++) {
      await db.query(
        `INSERT INTO mesa (numero_mesa, estado)
         VALUES (?, 'Disponible')
         ON CONFLICT DO NOTHING`,
        [String(n)]
      );
    }

    // Platillos de ejemplo: [nombre, categoria, precio]
    const platillos = [
      ["Lomo Saltado", "Calientes", 24.0],
      ["Ceviche Mixto", "Frias", 28.0],
      ["Anticuchos", "Parrilla", 18.0],
      ["Causa Limeña", "Entradas", 14.0],
      ["Picarones", "Postres", 10.0],
      ["Chicha Morada", "Bebidas", 6.0],
    ];

    for (const [nombre, categoria, precio] of platillos) {
      await db.query(
        `INSERT INTO platillo (nombre, descripcion, categoria, precio, disponibilidad)
         VALUES (?, '', ?, ?, 1)`,
        [nombre, categoria, precio]
      );
    }

    res.send("Mesas y platillos creados correctamente ✔");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error creando datos base");
  }
});

// 🔍 Endpoint para verificar el contenido del token
router.get("/verify-token", authenticateToken, (req, res) => {
  res.json({
    message: "Token válido",
    usuario: req.user,
    decodificado: {
      id: req.user?.id,
      rol: req.user?.rol,
      todosLosCampos: req.user
    }
  });
});

module.exports = router;
