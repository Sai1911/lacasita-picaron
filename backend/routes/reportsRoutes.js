const express = require("express");
const router = express.Router();
const reportsController = require("../controllers/reportsController");
const { authenticateToken, requireRole } = require("../middlewares/authMiddleware");

// SOLO ADMIN
router.get("/daily", authenticateToken, requireRole("Admin"), reportsController.getDailyReport);
router.get("/range", authenticateToken, requireRole("Admin"), reportsController.getRangeReport);
router.get("/monthly", authenticateToken, requireRole("Admin"), reportsController.getMonthlyReport);
router.get("/yearly", authenticateToken, requireRole("Admin"), reportsController.getYearlyReport);
router.get("/top-items", authenticateToken, requireRole("Admin"), reportsController.getTopItems);

module.exports = router;
