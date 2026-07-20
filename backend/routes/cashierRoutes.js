const express = require("express");
const router = express.Router();
const cashierController = require("../controllers/cashierController");
const { authenticateToken, requireRole } = require("../middlewares/authMiddleware");

// ---------------- Cuentas por cobrar ----------------
router.get(
  "/orders",
  authenticateToken,
  requireRole("Caja", "Admin"),
  cashierController.getOrdersToPay
);

router.post(
  "/orders/:id/pay",
  authenticateToken,
  requireRole("Caja", "Admin"),
  cashierController.payOrder
);

// Anular un cobro ya realizado (comprobante emitido por error)
router.post(
  "/orders/:id/anular",
  authenticateToken,
  requireRole("Caja", "Admin"),
  cashierController.anularCobro
);

// ---------------- Turno de caja ----------------
router.get(
  "/caja/actual",
  authenticateToken,
  requireRole("Caja", "Admin"),
  cashierController.getCajaActual
);

router.post(
  "/caja/abrir",
  authenticateToken,
  requireRole("Caja", "Admin"),
  cashierController.abrirCaja
);

router.post(
  "/caja/cerrar",
  authenticateToken,
  requireRole("Caja", "Admin"),
  cashierController.cerrarCaja
);

router.get(
  "/caja/cierres",
  authenticateToken,
  requireRole("Caja", "Admin"),
  cashierController.getCierres
);

module.exports = router;
