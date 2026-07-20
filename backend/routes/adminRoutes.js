const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { authenticateToken, requireRole } = require("../middlewares/authMiddleware");

// PERSONAL
router.get("/personal", authenticateToken, requireRole("Admin"), adminController.getPersonal);
router.post("/personal", authenticateToken, requireRole("Admin"), adminController.addPersonal);
router.put("/personal/:id", authenticateToken, requireRole("Admin"), adminController.updatePersonal);
router.put("/personal/:id/state", authenticateToken, requireRole("Admin"), adminController.togglePersonalState);
router.delete("/personal/:id", authenticateToken, requireRole("Admin"), adminController.deletePersonal);

// SEGURIDAD DE CUENTAS
router.put("/personal/:id/password", authenticateToken, requireRole("Admin"), adminController.resetPassword);
router.put("/personal/:id/desbloquear", authenticateToken, requireRole("Admin"), adminController.desbloquearPersonal);
router.get("/logs", authenticateToken, requireRole("Admin"), adminController.getLogSesiones);

// MENÚ
router.put("/menu/:id", authenticateToken, requireRole("Admin"), adminController.updateMenuItem);
router.put("/menu/:id/toggle", authenticateToken, requireRole("Admin"), adminController.toggleMenuAvailability);
router.delete("/menu/:id", authenticateToken, requireRole("Admin"), adminController.deleteMenuItem);

module.exports = router;
