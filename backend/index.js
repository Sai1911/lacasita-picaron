require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const http = require("http");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

// Sin clave de firma, cualquiera podría fabricar tokens válidos.
// Es preferible no arrancar a arrancar de forma insegura.
if (!process.env.SECRET_KEY) {
  console.error("\n❌ Falta la variable SECRET_KEY. El servidor no puede iniciar.\n");
  process.exit(1);
}

// Importar rutas
const authRoutes = require("./routes/authRoutes");
const menuRoutes = require("./routes/menuRoutes");
const tablesRoutes = require("./routes/tablesRoutes");
const ordersRoutes = require("./routes/ordersRoutes");
const kitchenRoutes = require("./routes/kitchenRoutes");
const cashierRoutes = require("./routes/cashierRoutes");
const reportsRoutes = require("./routes/reportsRoutes");
const adminRoutes = require("./routes/adminRoutes");
const devRoutes = require("./routes/devRoutes");

const app = express();
const server = http.createServer(app);

// Orígenes permitidos: el frontend local y el desplegado (Render).
// FRONTEND_URL puede ser una URL o varias separadas por comas.
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

// En Render la app corre detrás de un proxy: sin esto, el rate limit
// vería siempre la IP del proxy en lugar de la del cliente real.
app.set("trust proxy", 1);

// ================================
// CABECERAS DE SEGURIDAD
// ================================
app.use(helmet({
  // El PDF del comprobante se descarga desde otro dominio (el frontend),
  // así que la política por defecto (same-origin) lo bloquearía.
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// ================================
// CORS
// ================================
app.use(cors({
  origin: allowedOrigins,
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

// Límite de tamaño: evita que un cuerpo enorme agote la memoria
app.use(express.json({ limit: "1mb" }));

// ================================
// SOCKET.IO
// ================================
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// ---- Autenticación del handshake ----
// Antes cualquiera que conociera la URL podía conectarse y escuchar
// TODOS los pedidos del restaurante. Ahora se exige un JWT válido.
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error("No autorizado: falta el token"));
  }

  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    if (err) {
      return next(new Error("No autorizado: token inválido"));
    }
    socket.user = decoded; // { id, rol }
    next();
  });
});

// ---- Salas por rol ----
// Cada cliente entra a la sala de su rol, de modo que los eventos
// llegan solo a quien le incumben (la cocina no necesita enterarse
// de los cobros, ni la caja de cada platillo añadido).
io.on("connection", (socket) => {
  const { rol } = socket.user;
  socket.join(rol);
  console.log(`🟢 ${rol} conectado (${socket.id})`);

  socket.on("disconnect", () => {
    console.log(`🔴 ${rol} desconectado (${socket.id})`);
  });
});

// Emite un evento únicamente a los roles indicados.
function notificar(roles, evento, data) {
  roles.forEach((rol) => io.to(rol).emit(evento, data));
}

// Middleware para inyectar io y el notificador dentro de req
app.use((req, res, next) => {
  req.io = io;
  req.notify = notificar;
  next();
});

// ================================
// HEALTH CHECK (Render hace ping aquí)
// ================================
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "La Casita del Picaron API" });
});

// ================================
// RUTAS API
// ================================
app.use("/api/auth", authRoutes);         // Login
app.use("/api/menu", menuRoutes);         // Menú (Mozo, Cocina, Caja, Admin)
app.use("/api/tables", tablesRoutes);     // Mesas + pedidos actuales
app.use("/api/orders", ordersRoutes);     // Pedidos (Mozo)
app.use("/api/kitchen", kitchenRoutes);   // Cocina
app.use("/api/cashier", cashierRoutes);   // Caja
app.use("/api/reports", reportsRoutes);   // Reportes (Admin)
app.use("/api/admin", adminRoutes);       // Personal + Platillos (Admin)

// Rutas de siembra de datos: NO tienen autenticación, así que solo se
// montan si se habilitan a propósito. Úsalas para el primer arranque y
// luego pon ENABLE_DEV_ROUTES=false en Render.
if (process.env.ENABLE_DEV_ROUTES === "true") {
  app.use("/api/dev", devRoutes);
  console.log("⚠️  Rutas /api/dev habilitadas (sin autenticación)");
}


// ================================
// MANEJO DE ERRORES GLOBAL
// ================================
app.use((err, req, res, next) => {
  console.error("🔥 Error global:", err);
  res.status(500).json({
    error: "Error interno del servidor",
    details: err.message
  });
});

// ================================
// INICIAR SERVIDOR
// ================================
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`\n======================================`);
  console.log(`   🚀 Servidor escuchando en puerto ${PORT}`);
  console.log(`   ✅ CORS permitido para: ${allowedOrigins.join(", ")}`);
  console.log(`======================================\n`);
});
