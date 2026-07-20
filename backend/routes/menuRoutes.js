const express = require("express");
const router = express.Router();
const menuController = require("../controllers/menuController");
const { authenticateToken, requireRole } = require("../middlewares/authMiddleware");

router.get(
  "/",
  authenticateToken,
  requireRole("Mozo", "Cocina", "Caja", "Admin"),
  menuController.getMenu
);

router.post(
  "/",
  authenticateToken,
  requireRole("Admin"),
  menuController.addMenuItem
);

module.exports = router;
