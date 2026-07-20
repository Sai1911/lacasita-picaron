// backend/routes/ordersRoutes.js
const express = require("express");
const router = express.Router();
const ordersController = require("../controllers/ordersController");
const { authenticateToken, requireRole } = require("../middlewares/authMiddleware");

// 1) Crear pedido (MOZO)
router.post(
  "/",
  authenticateToken,
  // si quieres, puedes dejar solo "Mozo", pero así nunca habrá 403 por rol
  requireRole("Mozo", "Admin", "Caja", "Cocina"),
  ordersController.createOrder
);

// 2) Enviar pedido de una mesa a CAJA
router.put(
  "/table/:tableId/finish",
  authenticateToken,
  requireRole("Mozo", "Admin"),
  ordersController.finishOrderForTable
);

// 3) Listar pedidos pendientes para COCINA
router.get(
  "/pending/kitchen",
  authenticateToken,
  requireRole("Cocina", "Admin"),
  ordersController.getKitchenOrders
);

// 4) Marcar pedido como LISTO (cocina)
router.put(
  "/:id/ready",
  authenticateToken,
  requireRole("Cocina", "Admin"),
  ordersController.markOrderAsReady
);

// 4b) Mozo confirma que entregó el pedido en la mesa
router.put(
  "/:id/served",
  authenticateToken,
  requireRole("Mozo", "Admin"),
  ordersController.markOrderAsServed
);

// 5) Anular un pedido (antes de cobrarlo)
router.put(
  "/:id/cancel",
  authenticateToken,
  requireRole("Mozo", "Caja", "Admin"),
  ordersController.cancelOrder
);

// 6) Generar PDF de un pedido
router.get(
  "/:id/pdf",
  authenticateToken,
  requireRole("Caja", "Admin", "Mozo"),
  ordersController.generateOrderPDF
);

module.exports = router;
