// backend/routes/tablesRoutes.js
const express = require("express");
const router = express.Router();
const tablesController = require("../controllers/tablesController");
const {
  authenticateToken,
  requireRole,
} = require("../middlewares/authMiddleware");

router.get(
  "/",
  authenticateToken,
  requireRole("Mozo", "Cocina", "Caja", "Admin"),
  tablesController.getTables
);

router.get(
  "/:id/current-order",
  authenticateToken,
  requireRole("Mozo", "Cocina", "Caja", "Admin"),
  tablesController.getCurrentOrderByTable
);

module.exports = router;
