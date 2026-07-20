import axios from "axios";
import { getToken, clearSession } from "../utils/auth";

// En producción se define VITE_API_URL (ej. https://tu-backend.onrender.com/api).
// En local cae al backend de desarrollo.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api",
});

// 🔥 Interceptor para agregar el token en cada petición
api.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 🔥 Interceptor de respuesta: si el token expiró o es inválido,
// se limpia la sesión y se vuelve al login en vez de dejar la
// pantalla a medias con errores silenciosos.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const enLogin = window.location.pathname === "/";

    if (status === 401 && !enLogin) {
      clearSession();
      window.location.href = "/";
    }

    return Promise.reject(error);
  }
);

export default api;
