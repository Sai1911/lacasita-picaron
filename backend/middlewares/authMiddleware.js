// backend/middlewares/authMiddleware.js
require("dotenv").config();
const jwt = require("jsonwebtoken");

// Autenticación general con JWT
exports.authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res.status(401).json({ message: "Token requerido" });
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "Formato de token inválido" });
  }

  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    if (err) {
      console.error("JWT verify error:", err);
      return res.status(401).json({ message: "Token inválido" });
    }

    req.user = decoded; // { id, rol }
    next();
  });
};

// Requiere uno de estos roles: "Mozo", "Cocina", "Caja", "Admin"
exports.requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({ message: "No autorizado - Usuario no encontrado" });
    }

    if (!req.user.rol) {
      return res.status(403).json({ message: "No autorizado - Rol no definido" });
    }

    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({
        message: "No autorizado - Rol insuficiente",
        rolActual: req.user.rol,
        rolesPermitidos: roles
      });
    }

    next();
  };
};
