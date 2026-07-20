// frontend/src/pages/Login.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { saveSession } from "../utils/auth";

const Login = () => {
  const navigate = useNavigate();

  const [codigoAcceso, setCodigoAcceso] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      // 🔥 Enviar correctamente al backend
      const { data } = await api.post("/auth/login", {
        codigo_acceso: codigoAcceso,
        password,
      });

      // El backend devuelve: token, rol, nombre, id_personal
      const { token, rol, nombre, id_personal } = data;

      if (!token || !rol) {
        throw new Error("Respuesta de login inválida");
      }

      // Crear objeto usuario
      const user = {
        rol,
        nombre,
        id_personal,
      };

      // Guardar token Y usuario, para que la sesión sobreviva a un F5
      saveSession(token, user);
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      // 🔥 Redirección según rol
      switch (rol) {
        case "Mozo":
          navigate("/waiter", { state: { user } });
          break;
        case "Cocina":
          navigate("/kitchen", { state: { user } });
          break;
        case "Caja":
          navigate("/cashier", { state: { user } });
          break;
        case "Admin":
          navigate("/admin", { state: { user } });
          break;
        default:
          setErrorMsg("Rol no reconocido");
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(
        err.response?.data?.message ||
        "Código de acceso o contraseña incorrectos"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="bg-white shadow-lg rounded-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-6 text-center">
          Sistema de Restaurante
        </h1>

        {errorMsg && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Código de acceso
            </label>
            <input
              type="text"
              className="w-full border rounded px-3 py-2"
              value={codigoAcceso}
              onChange={(e) => setCodigoAcceso(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Contraseña
            </label>
            <input
              type="password"
              className="w-full border rounded px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 rounded disabled:opacity-60"
          >
            {loading ? "Ingresando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
