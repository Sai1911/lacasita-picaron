import api from "../api/axios";
import { clearSession } from "./auth";
import { desconectarSocket } from "../api/socket";

// Cierra la sesión: avisa al backend para cerrar el registro en la
// bitácora (logsesion) y luego limpia el almacenamiento local.
//
// Si la llamada falla (token ya expirado, sin red...) igual se limpia
// la sesión: nunca debe quedar el usuario atrapado sin poder salir.
export async function cerrarSesion() {
  try {
    await api.post("/auth/logout");
  } catch {
    // Silencioso a propósito
  } finally {
    desconectarSocket();
    clearSession();
  }
}
