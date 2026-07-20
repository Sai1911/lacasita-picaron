import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { getUser } from "../utils/auth";
import { cerrarSesion } from "../utils/logout";
import CambiarPassword from "../components/CambiarPassword";

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState("menu");
  const navigate = useNavigate();
  const user = getUser();

  const logout = async () => {
    await cerrarSesion();
    navigate("/");
  };

  return (
    <div className="p-6 bg-gray-100 min-h-screen">

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">
          Panel de Administración
        </h1>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-600">
            {user ? `${user.nombre} (Admin)` : "Admin"}
          </span>
          <CambiarPassword />
          <button
            onClick={logout}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded text-sm"
          >
            Salir
          </button>
        </div>
      </div>

      <div className="flex space-x-6 border-b pb-2 mb-6">
        <button
          onClick={() => setActiveTab("menu")}
          className={`${activeTab === "menu" ? "border-b-2 border-orange-500 font-bold" : "text-gray-600"}`}
        >
          Menú
        </button>

        <button
          onClick={() => setActiveTab("staff")}
          className={`${activeTab === "staff" ? "border-b-2 border-orange-500 font-bold" : "text-gray-600"}`}
        >
          Personal
        </button>

        <button
          onClick={() => setActiveTab("reports")}
          className={`${activeTab === "reports" ? "border-b-2 border-orange-500 font-bold" : "text-gray-600"}`}
        >
          Reportes
        </button>

        <button
          onClick={() => setActiveTab("auditoria")}
          className={`${activeTab === "auditoria" ? "border-b-2 border-orange-500 font-bold" : "text-gray-600"}`}
        >
          Auditoría
        </button>
      </div>

      {activeTab === "menu" && <MenuSection />}
      {activeTab === "staff" && <StaffSection />}
      {activeTab === "reports" && <ReportsSection />}
      {activeTab === "auditoria" && <AuditoriaSection />}
    </div>
  );
}

/* ------------------------------------------------------------- */
/* ---------------------- SECCIÓN MENÚ -------------------------- */
/* ------------------------------------------------------------- */
const CATEGORIAS = [
  "Calientes",
  "Frias",
  "Parrilla",
  "Entradas",
  "Postres",
  "Bebidas",
];

function MenuSection() {
  const [menu, setMenu] = useState([]);
  const [editando, setEditando] = useState(null); // platillo en edición
  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    category: "Calientes",
    price: "",
  });

  const loadMenu = async () => {
    const { data } = await api.get("/menu");
    setMenu(data);
  };

  useEffect(() => {
    loadMenu();
  }, []);

  const addItem = async () => {
    await api.post("/menu", {
      name: newItem.name,
      description: newItem.description,
      category: newItem.category,
      price: parseFloat(newItem.price || 0),
      disponibilidad: 1,
    });

    setNewItem({ name: "", description: "", category: "Calientes", price: "" });
    loadMenu();
    alert("Platillo agregado");
  };

  const toggleDisponibilidad = async (id) => {
    await api.put(`/admin/menu/${id}/toggle`);
    loadMenu();
  };

  // Editar un platillo existente. El endpoint PUT /admin/menu/:id ya
  // existía en el backend pero no había forma de invocarlo: no se podía
  // corregir ni el precio de un plato.
  const guardarEdicion = async () => {
    if (!editando.nombre?.trim()) {
      alert("El nombre no puede quedar vacío");
      return;
    }

    try {
      await api.put(`/admin/menu/${editando.id}`, {
        nombre: editando.nombre,
        descripcion: editando.descripcion || "",
        categoria: editando.categoria,
        precio: Number(editando.precio),
      });
      setEditando(null);
      loadMenu();
    } catch (err) {
      alert(err.response?.data?.error || "Error al actualizar el platillo");
    }
  };

  const deleteItem = async (id, nombre) => {
    if (!window.confirm(`¿Estás seguro de eliminar el platillo "${nombre}"?`)) {
      return;
    }
    try {
      await api.delete(`/admin/menu/${id}`);
      loadMenu();
      alert("Platillo eliminado correctamente");
    } catch (err) {
      console.error("Error eliminando platillo:", err);
      alert("Error al eliminar platillo");
    }
  };

  return (
    <div className="grid grid-cols-2 gap-10">

      <div>
        <h2 className="text-xl font-bold mb-3">Platillos Registrados</h2>

        <table className="w-full bg-white rounded shadow text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Nombre</th>
              <th className="p-2">Categoría</th>
              <th className="p-2 text-right">Precio</th>
              <th className="p-2 text-center">Disp.</th>
              <th className="p-2 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {menu.map((p) => (
              <tr key={p.id} className="border-b hover:bg-gray-50">
                <td className="p-2">{p.name}</td>
                <td className="p-2 text-center">{p.category}</td>

                {/* FIX: prevenir undefined.toFixed */}
                <td className="p-2 text-right">
                  S/ {Number(p.price || 0).toFixed(2)}
                </td>

                <td className="p-2 text-center">
                  <button
                    onClick={() => toggleDisponibilidad(p.id)}
                    className={`px-3 py-1 rounded text-white text-xs ${
                      p.disponibilidad === 1 ? "bg-green-600" : "bg-red-600"
                    }`}
                  >
                    {p.disponibilidad === 1 ? "ON" : "OFF"}
                  </button>
                </td>

                <td className="p-2 text-center whitespace-nowrap">
                  <button
                    onClick={() =>
                      setEditando({
                        id: p.id,
                        nombre: p.name,
                        descripcion: p.description || "",
                        categoria: p.category,
                        precio: p.price,
                      })
                    }
                    className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white text-xs mr-1"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => deleteItem(p.id, p.name)}
                    className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-xs"
                  >
                    Eliminar
                  </button>
                </td>

              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">Registrar Platillo</h2>
        <div className="space-y-3">
          <input
            className="w-full border p-2 rounded"
            placeholder="Nombre"
            value={newItem.name}
            onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
          />

          <input
            className="w-full border p-2 rounded"
            placeholder="Descripción"
            value={newItem.description}
            onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
          />

          <input
            className="w-full border p-2 rounded"
            placeholder="Precio"
            type="number"
            value={newItem.price}
            onChange={(e) => setNewItem({ ...newItem, price: e.target.value })}
          />

          {/* Deben coincidir exactamente con el CHECK de la tabla platillo */}
          <select
            className="w-full border p-2 rounded"
            value={newItem.category}
            onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
          >
            {CATEGORIAS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>

          <button
            onClick={addItem}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white p-2 rounded"
          >
            Guardar
          </button>
        </div>
      </div>

      {/* ---------- MODAL DE EDICIÓN ---------- */}
      {editando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Editar platillo</h2>

            <label className="block text-sm mb-1">Nombre</label>
            <input
              className="w-full border p-2 rounded mb-3"
              value={editando.nombre}
              onChange={(e) =>
                setEditando({ ...editando, nombre: e.target.value })
              }
            />

            <label className="block text-sm mb-1">Descripción</label>
            <input
              className="w-full border p-2 rounded mb-3"
              value={editando.descripcion}
              onChange={(e) =>
                setEditando({ ...editando, descripcion: e.target.value })
              }
            />

            <label className="block text-sm mb-1">Categoría</label>
            <select
              className="w-full border p-2 rounded mb-3"
              value={editando.categoria}
              onChange={(e) =>
                setEditando({ ...editando, categoria: e.target.value })
              }
            >
              {CATEGORIAS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>

            <label className="block text-sm mb-1">Precio</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="w-full border p-2 rounded mb-4"
              value={editando.precio}
              onChange={(e) =>
                setEditando({ ...editando, precio: e.target.value })
              }
            />

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditando(null)}
                className="px-4 py-2 rounded border"
              >
                Cancelar
              </button>
              <button
                onClick={guardarEdicion}
                className="px-4 py-2 rounded bg-blue-600 text-white"
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- */
/* -------------------- SECCIÓN PERSONAL ------------------------ */
/* ------------------------------------------------------------- */
function StaffSection() {
  const [staff, setStaff] = useState([]);
  const [editando, setEditando] = useState(null); // trabajador en edición
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    dni: "",
    correo: "",
    cargo: "Mozo",
    codigo_acceso: "",
    password: "",
  });

  const loadStaff = async () => {
    const { data } = await api.get("/admin/personal");
    setStaff(data);
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const register = async () => {
    await api.post("/admin/personal", form);
    loadStaff();
    alert("Trabajador registrado");
  };

  const toggleState = async (id) => {
    await api.put(`/admin/personal/${id}/state`);
    loadStaff();
  };

  const deleteStaff = async (id, nombre) => {
    if (!window.confirm(`¿Estás seguro de eliminar a ${nombre}?`)) {
      return;
    }
    try {
      await api.delete(`/admin/personal/${id}`);
      loadStaff();
      alert("Trabajador eliminado correctamente");
    } catch (err) {
      console.error("Error eliminando trabajador:", err);
      alert("Error al eliminar trabajador");
    }
  };

  // Editar datos de un trabajador. El endpoint PUT /admin/personal/:id
  // existía en el backend sin interfaz: no se podía ni corregir un nombre.
  const guardarEdicion = async () => {
    if (!editando.nombre?.trim() || !editando.apellido?.trim()) {
      alert("Nombre y apellido son obligatorios");
      return;
    }

    try {
      await api.put(`/admin/personal/${editando.id}`, {
        nombre: editando.nombre,
        apellido: editando.apellido,
        cargo: editando.cargo,
      });
      setEditando(null);
      loadStaff();
    } catch (err) {
      alert(err.response?.data?.error || "Error al actualizar el trabajador");
    }
  };

  // Desbloquea una cuenta bloqueada por intentos fallidos
  const desbloquear = async (id, nombre) => {
    try {
      await api.put(`/admin/personal/${id}/desbloquear`);
      loadStaff();
      alert(`Cuenta de ${nombre} desbloqueada`);
    } catch (err) {
      alert(err.response?.data?.error || "Error al desbloquear la cuenta");
    }
  };

  // Restablece la contraseña (y de paso desbloquea la cuenta)
  const resetPassword = async (id, nombre) => {
    const nueva = window.prompt(
      `Nueva contraseña para ${nombre} (mínimo 6 caracteres):`
    );
    if (!nueva) return;

    if (nueva.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    try {
      await api.put(`/admin/personal/${id}/password`, { password_nueva: nueva });
      loadStaff();
      alert(`Contraseña de ${nombre} restablecida`);
    } catch (err) {
      alert(err.response?.data?.error || "Error al restablecer la contraseña");
    }
  };

  return (
    <div className="grid grid-cols-2 gap-10">

      <div>
        <h2 className="text-xl font-bold mb-3">Personal Registrado</h2>

        <div className="bg-white rounded shadow p-4 max-h-96 overflow-y-auto">
          {staff.map((p) => (
            <div key={p.id_personal} className="border-b py-2 flex justify-between items-center gap-2">

              <div className="flex-1">
                <div className="font-bold flex items-center gap-2">
                  {p.nombre} {p.apellido}
                  {p.bloqueado && (
                    <span className="px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full">
                      🔒 Bloqueado
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {p.cargo}
                  {p.intentos_fallidos > 0 && !p.bloqueado && (
                    <span className="text-orange-600 ml-2">
                      {p.intentos_fallidos} intento(s) fallido(s)
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2 flex-wrap justify-end">
                <button
                  onClick={() => toggleState(p.id_personal)}
                  className={`px-3 py-1 rounded text-white text-xs ${
                    p.estado === "activo" ? "bg-green-600" : "bg-red-600"
                  }`}
                >
                  {p.estado}
                </button>

                {p.bloqueado && (
                  <button
                    onClick={() =>
                      desbloquear(p.id_personal, `${p.nombre} ${p.apellido}`)
                    }
                    className="px-3 py-1 rounded bg-orange-500 hover:bg-orange-600 text-white text-xs"
                  >
                    Desbloquear
                  </button>
                )}

                <button
                  onClick={() =>
                    setEditando({
                      id: p.id_personal,
                      nombre: p.nombre,
                      apellido: p.apellido,
                      cargo: p.cargo,
                    })
                  }
                  className="px-3 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white text-xs"
                >
                  Editar
                </button>

                <button
                  onClick={() =>
                    resetPassword(p.id_personal, `${p.nombre} ${p.apellido}`)
                  }
                  className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-xs"
                >
                  Contraseña
                </button>

                <button
                  onClick={() => deleteStaff(p.id_personal, `${p.nombre} ${p.apellido}`)}
                  className="px-3 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-xs"
                >
                  Eliminar
                </button>
              </div>

            </div>
          ))}
        </div>
      </div>

      <div className="bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">Registrar Personal</h2>

        <div className="space-y-3">
          <input className="w-full border p-2" placeholder="Nombre"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />

          <input className="w-full border p-2" placeholder="Apellido"
            value={form.apellido}
            onChange={(e) => setForm({ ...form, apellido: e.target.value })}
          />

          <input className="w-full border p-2" placeholder="DNI"
            value={form.dni}
            onChange={(e) => setForm({ ...form, dni: e.target.value })}
          />

          <input className="w-full border p-2" placeholder="Correo"
            value={form.correo}
            onChange={(e) => setForm({ ...form, correo: e.target.value })}
          />

          <select
            className="w-full border p-2"
            value={form.cargo}
            onChange={(e) => setForm({ ...form, cargo: e.target.value })}
          >
            <option>Mozo</option>
            <option>Cocina</option>
            <option>Caja</option>
            <option>Admin</option>
          </select>

          <input
            className="w-full border p-2"
            placeholder="Código de acceso"
            value={form.codigo_acceso}
            onChange={(e) => setForm({ ...form, codigo_acceso: e.target.value })}
          />

          <input
            className="w-full border p-2"
            placeholder="Contraseña"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />

          <button
            onClick={register}
            className="w-full bg-green-600 hover:bg-green-700 text-white p-2 rounded"
          >
            Registrar
          </button>
        </div>
      </div>

      {/* ---------- MODAL DE EDICIÓN ---------- */}
      {editando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Editar trabajador</h2>

            <label className="block text-sm mb-1">Nombre</label>
            <input
              className="w-full border p-2 rounded mb-3"
              value={editando.nombre}
              onChange={(e) =>
                setEditando({ ...editando, nombre: e.target.value })
              }
            />

            <label className="block text-sm mb-1">Apellido</label>
            <input
              className="w-full border p-2 rounded mb-3"
              value={editando.apellido}
              onChange={(e) =>
                setEditando({ ...editando, apellido: e.target.value })
              }
            />

            <label className="block text-sm mb-1">Cargo</label>
            <select
              className="w-full border p-2 rounded mb-4"
              value={editando.cargo}
              onChange={(e) =>
                setEditando({ ...editando, cargo: e.target.value })
              }
            >
              <option>Mozo</option>
              <option>Cocina</option>
              <option>Caja</option>
              <option>Admin</option>
            </select>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditando(null)}
                className="px-4 py-2 rounded border"
              >
                Cancelar
              </button>
              <button
                onClick={guardarEdicion}
                className="px-4 py-2 rounded bg-blue-600 text-white"
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- */
/* -------------------- SECCIÓN REPORTES ------------------------ */
/* ------------------------------------------------------------- */
function ReportsSection() {
  const [reportType, setReportType] = useState("daily");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Rango: por defecto, la última semana
  const [desde, setDesde] = useState(
    new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  );
  const [hasta, setHasta] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    const loadReport = async () => {
      setLoading(true);
      try {
        let data;

        if (reportType === "daily") {
          const response = await api.get(`/reports/daily?date=${selectedDate}`);
          data = response.data;
        } else if (reportType === "range") {
          const response = await api.get(
            `/reports/range?from=${desde}&to=${hasta}`
          );
          data = response.data;
        } else if (reportType === "monthly") {
          const response = await api.get(`/reports/monthly?month=${selectedMonth}&year=${selectedYear}`);
          data = response.data;
        } else if (reportType === "yearly") {
          const response = await api.get(`/reports/yearly?year=${selectedYear}`);
          data = response.data;
        }

        setReport(data);
      } catch (err) {
        console.error("Error cargando reporte:", err);
        alert("Error al cargar reporte");
      }
      setLoading(false);
    };

    loadReport();
  }, [reportType, selectedDate, selectedMonth, selectedYear, desde, hasta]);

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Reportes de Ventas</h2>

      <div className="bg-white p-4 rounded shadow mb-4">
        <div className="flex gap-4 mb-4">
          <button
            onClick={() => setReportType("daily")}
            className={`px-4 py-2 rounded ${
              reportType === "daily" ? "bg-blue-600 text-white" : "bg-gray-200"
            }`}
          >
            Diario
          </button>

          <button
            onClick={() => setReportType("range")}
            className={`px-4 py-2 rounded ${
              reportType === "range" ? "bg-blue-600 text-white" : "bg-gray-200"
            }`}
          >
            Por rango
          </button>

          <button
            onClick={() => setReportType("monthly")}
            className={`px-4 py-2 rounded ${
              reportType === "monthly" ? "bg-blue-600 text-white" : "bg-gray-200"
            }`}
          >
            Mensual
          </button>

          <button
            onClick={() => setReportType("yearly")}
            className={`px-4 py-2 rounded ${
              reportType === "yearly" ? "bg-blue-600 text-white" : "bg-gray-200"
            }`}
          >
            Anual
          </button>
        </div>

        <div className="flex gap-4">
          {reportType === "daily" && (
            <div>
              <label className="block text-sm font-medium mb-1">Fecha:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border rounded px-3 py-2"
              />
            </div>
          )}

          {reportType === "range" && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Desde:</label>
                <input
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  className="border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Hasta:</label>
                <input
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  className="border rounded px-3 py-2"
                />
              </div>
            </>
          )}

          {reportType === "monthly" && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Mes:</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="border rounded px-3 py-2"
                >
                  {monthNames.map((month, idx) => (
                    <option key={idx} value={idx + 1}>{month}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Año:</label>
                <input
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="border rounded px-3 py-2"
                  min="2020"
                  max="2030"
                />
              </div>
            </>
          )}

          {reportType === "yearly" && (
            <div>
              <label className="block text-sm font-medium mb-1">Año:</label>
              <input
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="border rounded px-3 py-2"
                min="2020"
                max="2030"
              />
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500">Cargando...</p>
      ) : report ? (
        <div className="bg-white p-6 rounded shadow">

          {/* ------------------ DAILY ------------------ */}
          {reportType === "daily" && (
            <>
              <h3 className="text-lg font-bold mb-2">
                Reporte del {new Date(selectedDate).toLocaleDateString()}
              </h3>
              <p className="text-3xl font-bold text-green-600 mb-4">
                S/ {Number(report.total || 0).toFixed(2)}
              </p>

              {report.pagos && report.pagos.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2">Detalle de pagos:</h4>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-2 text-left">Monto</th>
                        <th className="p-2 text-left">Método</th>
                        <th className="p-2 text-left">Hora</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.pagos.map((pago, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="p-2">S/ {Number(pago.monto_total || 0).toFixed(2)}</td>
                          <td className="p-2">{pago.metodo_pago}</td>
                          <td className="p-2">
                            {new Date(pago.fecha_pago).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ------------------ MONTHLY ------------------ */}
          {reportType === "monthly" && (
            <>
              <h3 className="text-lg font-bold mb-2">
                Reporte de {monthNames[selectedMonth - 1]} {selectedYear}
              </h3>
              <p className="text-3xl font-bold text-green-600 mb-4">
                S/ {Number(report.totalMes || 0).toFixed(2)}
              </p>

              {report.detalle && report.detalle.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2">Ventas por día:</h4>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-2 text-left">Día</th>
                        <th className="p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.detalle.map((dia, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="p-2">{new Date(dia.dia).toLocaleDateString()}</td>
                          <td className="p-2 text-right">S/ {Number(dia.total || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ------------------ YEARLY ------------------ */}
          {reportType === "yearly" && (
            <>
              <h3 className="text-lg font-bold mb-2">
                Reporte del año {selectedYear}
              </h3>
              <p className="text-3xl font-bold text-green-600 mb-4">
                S/ {Number(report.totalAnual || 0).toFixed(2)}
              </p>

              {report.detalle && report.detalle.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2">Ventas por mes:</h4>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-2 text-left">Mes</th>
                        <th className="p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.detalle.map((mes, idx) => (
                        <tr key={idx} className="border-b">
                          <td className="p-2">{monthNames[mes.mes - 1]}</td>
                          <td className="p-2 text-right">S/ {Number(mes.total || 0).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

        </div>
      ) : (
        <p className="text-gray-500">No hay datos para mostrar</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- */
/* -------------------- SECCIÓN AUDITORÍA ----------------------- */
/* ------------------------------------------------------------- */
// Consume dos endpoints que existían en el backend sin interfaz:
//   GET /admin/logs            → bitácora de accesos (logsesion)
//   GET /cashier/caja/cierres  → historial de arqueos (reportecierre)
function AuditoriaSection() {
  const [vista, setVista] = useState("accesos");
  const [logs, setLogs] = useState([]);
  const [cierres, setCierres] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      setCargando(true);
      try {
        if (vista === "accesos") {
          const { data } = await api.get("/admin/logs");
          setLogs(data);
        } else {
          const { data } = await api.get("/cashier/caja/cierres");
          setCierres(data);
        }
      } catch (err) {
        console.error("Error cargando auditoría", err);
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, [vista]);

  const fecha = (f) => (f ? new Date(f).toLocaleString("es-PE") : "—");

  const etiquetaEvento = {
    login: { txt: "Ingreso", css: "bg-green-100 text-green-700" },
    login_fallido: { txt: "Intento fallido", css: "bg-red-100 text-red-700" },
    logout: { txt: "Salida", css: "bg-gray-100 text-gray-700" },
    cambio_password: { txt: "Cambió contraseña", css: "bg-blue-100 text-blue-700" },
  };

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <button
          onClick={() => setVista("accesos")}
          className={`px-4 py-2 rounded ${
            vista === "accesos" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
        >
          Bitácora de accesos
        </button>
        <button
          onClick={() => setVista("cierres")}
          className={`px-4 py-2 rounded ${
            vista === "cierres" ? "bg-blue-600 text-white" : "bg-gray-200"
          }`}
        >
          Cierres de caja
        </button>
      </div>

      {cargando ? (
        <p className="text-gray-500">Cargando...</p>
      ) : vista === "accesos" ? (
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Fecha</th>
                <th className="p-2 text-left">Usuario</th>
                <th className="p-2 text-left">Cargo</th>
                <th className="p-2 text-left">Evento</th>
                <th className="p-2 text-left">Cierre</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-4 text-center text-gray-500">
                    Sin registros todavía
                  </td>
                </tr>
              ) : (
                logs.map((l) => {
                  const e = etiquetaEvento[l.tipo_evento] || {
                    txt: l.tipo_evento,
                    css: "bg-gray-100 text-gray-700",
                  };
                  return (
                    <tr key={l.id_log} className="border-b hover:bg-gray-50">
                      <td className="p-2">{fecha(l.fecha_hora_inicio)}</td>
                      <td className="p-2">
                        {l.nombre} {l.apellido}
                      </td>
                      <td className="p-2">{l.cargo}</td>
                      <td className="p-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${e.css}`}>
                          {e.txt}
                        </span>
                      </td>
                      <td className="p-2 text-gray-500">
                        {fecha(l.fecha_hora_cierre)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Fecha de cierre</th>
                <th className="p-2 text-left">Caja</th>
                <th className="p-2 text-left">Cajero</th>
                <th className="p-2 text-right">Ingresos</th>
                <th className="p-2 text-right">Egresos</th>
                <th className="p-2 text-right">Saldo final</th>
                <th className="p-2 text-left">Observación</th>
              </tr>
            </thead>
            <tbody>
              {cierres.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-4 text-center text-gray-500">
                    Todavía no se ha cerrado ninguna caja
                  </td>
                </tr>
              ) : (
                cierres.map((c) => (
                  <tr key={c.id_reporte} className="border-b hover:bg-gray-50">
                    <td className="p-2">{fecha(c.fecha_cierre)}</td>
                    <td className="p-2">
                      {c.nombre_caja} {c.turno ? `· ${c.turno}` : ""}
                    </td>
                    <td className="p-2">
                      {c.nombre_cajero} {c.apellido_cajero}
                    </td>
                    <td className="p-2 text-right text-green-700">
                      S/ {Number(c.total_ingresos).toFixed(2)}
                    </td>
                    <td className="p-2 text-right text-red-600">
                      S/ {Number(c.total_egresos).toFixed(2)}
                    </td>
                    <td className="p-2 text-right font-bold">
                      S/ {Number(c.saldo_final).toFixed(2)}
                    </td>
                    <td className="p-2 text-gray-500">{c.observacion || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
