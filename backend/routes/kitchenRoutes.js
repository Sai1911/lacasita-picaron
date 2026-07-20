// backend/routes/kitchenRoutes.js
const express = require("express");
const router = express.Router();
const kitchenController = require("../controllers/kitchenController");
const {
  authenticateToken,
  requireRole,
} = require("../middlewares/authMiddleware");

// Ver pedidos pendientes
router.get(
  "/orders",
  authenticateToken,
  requireRole("Cocina", "Admin"),
  kitchenController.getPendingOrders
);

// Marcar pedido como listo
router.put(
  "/orders/:id/ready",
  authenticateToken,
  requireRole("Cocina", "Admin"),
  kitchenController.markOrderReady
);

module.exports = router;
