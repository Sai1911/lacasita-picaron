import { io } from "socket.io-client";
import { getToken } from "../utils/auth";

// En producción se define VITE_SOCKET_URL (ej. https://tu-backend.onrender.com).
// Se permite fallback a "polling" por si el entorno no soporta websockets puros.
//
// autoConnect: false → el socket NO se conecta al cargar el módulo, porque
// en la pantalla de login todavía no hay token y el servidor rechazaría
// la conexión. Cada panel llama a conectarSocket() al montarse.
const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:3000", {
  transports: ["websocket", "polling"],
  autoConnect: false,
});

export function conectarSocket() {
  if (socket.connected) return socket;

  // El token viaja en el handshake; el backend lo verifica y mete
  // al cliente en la sala de su rol.
  socket.auth = { token: getToken() };
  socket.connect();
  return socket;
}

export function desconectarSocket() {
  if (socket.connected) socket.disconnect();
}

socket.on("connect_error", (err) => {
  console.error("Socket rechazado:", err.message);
});

export default socket;
