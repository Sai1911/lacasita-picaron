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
    <div className="min-h-screen flex items-center justify-center p-4
                    bg-gradient-to-br from-brand-100 via-crema to-terracota-100">
      <div className="w-full max-w-md">
        {/* Marca */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center
                          rounded-full bg-brand-500 shadow-soft text-4xl">
            🍩
          </div>
          <h1 className="font-logo text-4xl text-brand-700 leading-tight">
            La Casita del Picarón
          </h1>
          <p className="text-sm text-carbon/60 mt-1">
            Sistema de comandas
          </p>
        </div>

        {/* Tarjeta de acceso */}
        <div className="card p-8">
          <h2 className="text-lg font-semibold mb-5 text-center text-carbon">
            Iniciar sesión
          </h2>

          {errorMsg && (
            <div className="mb-4 text-sm text-terracota-700 bg-terracota-50
                            border border-terracota-100 rounded-lg p-3">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 text-carbon/80">
                Código de acceso
              </label>
              <input
                type="text"
                className="field"
                placeholder="ej. mozo1"
                value={codigoAcceso}
                onChange={(e) => setCodigoAcceso(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5 text-carbon/80">
                Contraseña
              </label>
              <input
                type="password"
                className="field"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-2.5 text-base"
            >
              {loading ? "Ingresando…" : "Entrar"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-carbon/40 mt-6">
          © {new Date().getFullYear()} La Casita del Picarón
        </p>
      </div>
    </div>
  );
};

export default Login;
