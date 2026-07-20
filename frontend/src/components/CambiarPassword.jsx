import { useState } from "react";
import api from "../api/axios";

// Botón + modal para que cualquier usuario cambie su propia contraseña.
// El endpoint PUT /auth/password ya existía en el backend pero no había
// forma de llegar a él desde la interfaz.
export default function CambiarPassword() {
  const [abierto, setAbierto] = useState(false);
  const [form, setForm] = useState({ actual: "", nueva: "", repetir: "" });
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [enviando, setEnviando] = useState(false);

  const cerrar = () => {
    setAbierto(false);
    setForm({ actual: "", nueva: "", repetir: "" });
    setError("");
    setOk("");
  };

  const guardar = async () => {
    setError("");
    setOk("");

    if (form.nueva.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (form.nueva !== form.repetir) {
      setError("Las contraseñas nuevas no coinciden");
      return;
    }

    setEnviando(true);
    try {
      await api.put("/auth/password", {
        password_actual: form.actual,
        password_nueva: form.nueva,
      });
      setOk("Contraseña actualizada correctamente");
      setForm({ actual: "", nueva: "", repetir: "" });
    } catch (err) {
      setError(
        err.response?.data?.message || "No se pudo cambiar la contraseña"
      );
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        className="text-sm text-gray-600 hover:text-gray-900 underline"
      >
        Cambiar contraseña
      </button>

      {abierto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">Cambiar mi contraseña</h2>

            {error && (
              <div className="mb-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-2">
                {error}
              </div>
            )}
            {ok && (
              <div className="mb-3 text-sm text-green-700 bg-green-50 border border-green-200 rounded p-2">
                {ok}
              </div>
            )}

            <input
              type="password"
              className="w-full border rounded px-3 py-2 mb-2"
              placeholder="Contraseña actual"
              value={form.actual}
              onChange={(e) => setForm({ ...form, actual: e.target.value })}
            />
            <input
              type="password"
              className="w-full border rounded px-3 py-2 mb-2"
              placeholder="Nueva contraseña (mín. 6)"
              value={form.nueva}
              onChange={(e) => setForm({ ...form, nueva: e.target.value })}
            />
            <input
              type="password"
              className="w-full border rounded px-3 py-2 mb-4"
              placeholder="Repetir nueva contraseña"
              value={form.repetir}
              onChange={(e) => setForm({ ...form, repetir: e.target.value })}
            />

            <div className="flex gap-2 justify-end">
              <button onClick={cerrar} className="px-4 py-2 rounded border">
                Cerrar
              </button>
              <button
                onClick={guardar}
                disabled={enviando}
                className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60"
              >
                {enviando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
