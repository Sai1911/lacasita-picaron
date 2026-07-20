const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();
const authController = require("../controllers/authController");
const { authenticateToken } = require("../middlewares/authMiddleware");

// Limita los intentos de login por IP: frena la fuerza bruta antes
// incluso de llegar a consultar la base de datos.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20,                  // 20 intentos por IP en esa ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Demasiados intentos de inicio de sesión. Espera unos minutos.",
  },
});

// LOGIN de cualquier usuario del personal (Mozo, Cocina, Caja, Admin)
router.post("/login", loginLimiter, authController.login);

// Cierre de sesión (registra la salida en la bitácora)
router.post("/logout", authenticateToken, authController.logout);

// Cambio de contraseña del propio usuario
router.put("/password", authenticateToken, authController.cambiarPassword);

module.exports = router;
