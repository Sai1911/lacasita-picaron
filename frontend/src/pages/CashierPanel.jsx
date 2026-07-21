// frontend/src/pages/CashierPanel.jsx
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";
import socket, { conectarSocket } from "../api/socket";
import { resolveUser } from "../utils/auth";
import { cerrarSesion } from "../utils/logout";
import AppHeader from "../components/AppHeader";

const soles = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

export default function CashierPanel() {
  const navigate = useNavigate();
  const location = useLocation();

  // Sobrevive a un F5: si no viene por navegación, se lee de localStorage.
  const user = resolveUser(location.state?.user);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estado del turno de caja
  const [caja, setCaja] = useState(null);
  const [cajaAbierta, setCajaAbierta] = useState(false);
  const [aperturaForm, setAperturaForm] = useState({
    nombre_caja: "Caja 1",
    turno: "Mañana",
    saldo_inicial: "",
  });

  // Cierre de caja
  const [mostrarCierre, setMostrarCierre] = useState(false);
  const [cierreForm, setCierreForm] = useState({
    total_egresos: "",
    observacion: "",
  });
  const [resumenCierre, setResumenCierre] = useState(null);

  // Datos de pago por cada pedido
  const [paymentData, setPaymentData] = useState({});

  // ===================== CARGA =====================
  const loadOrders = async () => {
    try {
      const { data } = await api.get("/cashier/orders");
      setOrders(data);
    } catch (err) {
      console.error("Error cargando pedidos por pagar", err);
    } finally {
      setLoading(false);
    }
  };

  const loadCaja = async () => {
    try {
      const { data } = await api.get("/cashier/caja/actual");
      setCajaAbierta(data.abierta);
      setCaja(data.caja);
    } catch (err) {
      console.error("Error cargando estado de caja", err);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }

    conectarSocket();
    loadOrders();
    loadCaja();

    const handleToCashier = () => loadOrders();
    const handleCancelled = () => loadOrders();

    socket.on("orderToCashier", handleToCashier);
    socket.on("orderCancelled", handleCancelled);

    return () => {
      socket.off("orderToCashier", handleToCashier);
      socket.off("orderCancelled", handleCancelled);
    };
  }, [user, navigate]);

  // ===================== APERTURA =====================
  const abrirCaja = async () => {
    if (aperturaForm.saldo_inicial === "") {
      alert("Ingresa el saldo inicial con el que abres la caja.");
      return;
    }

    try {
      await api.post("/cashier/caja/abrir", {
        nombre_caja: aperturaForm.nombre_caja,
        turno: aperturaForm.turno,
        saldo_inicial: Number(aperturaForm.saldo_inicial),
      });
      await loadCaja();
    } catch (err) {
      alert(err.response?.data?.error || "No se pudo aperturar la caja.");
    }
  };

  // ===================== CIERRE =====================
  const cerrarCaja = async () => {
    try {
      const { data } = await api.post("/cashier/caja/cerrar", {
        total_egresos: Number(cierreForm.total_egresos || 0),
        observacion: cierreForm.observacion,
      });

      setResumenCierre(data);
      setMostrarCierre(false);
      setCierreForm({ total_egresos: "", observacion: "" });
      await loadCaja();
    } catch (err) {
      alert(err.response?.data?.error || "No se pudo cerrar la caja.");
    }
  };

  // ===================== COBRO =====================
  const handleChangePaymentField = (orderId, field, value) => {
    setPaymentData((prev) => ({
      ...prev,
      [orderId]: { ...prev[orderId], [field]: value },
    }));
  };

  const payOrder = async (order) => {
    const form = paymentData[order.id_pedido] || {};

    const metodo_pago = form.metodo_pago || "Efectivo";
    const tipo_comprobante = form.tipo_comprobante || "boleta";
    const nombre_cliente = form.nombre_cliente || "";
    const doc_cliente = form.doc_cliente || "";
    const descuento = Number(form.descuento || 0);
    const propina = Number(form.propina || 0);

    const totalCobrar = Number(order.total) - descuento + propina;

    if (
      !window.confirm(
        `Confirmar cobro de ${soles(totalCobrar)} para la mesa ${order.id_mesa}?`
      )
    )
      return;

    try {
      const { data } = await api.post(
        `/cashier/orders/${order.id_pedido}/pay`,
        {
          metodo_pago,
          tipo_comprobante,
          nombre_cliente,
          doc_cliente,
          descuento,
          propina,
        }
      );

      await abrirComprobante(order.id_pedido);
      await Promise.all([loadOrders(), loadCaja()]);

      alert(
        `Cobro registrado.\nComprobante: ${data.numero_comprobante}`
      );
    } catch (err) {
      console.error("Error al registrar pago", err);
      alert(err.response?.data?.error || "No se pudo completar el pago.");
    }
  };

  // Anula un cobro ya emitido (comprobante equivocado).
  // El pedido vuelve a la lista de cuentas por cobrar.
  const anularCobro = async () => {
    const idPedido = window.prompt(
      "N° de pedido cuyo cobro quieres anular:"
    );
    if (!idPedido) return;

    const motivo = window.prompt("Motivo de la anulación (obligatorio):");
    if (!motivo) return;

    try {
      const { data } = await api.post(
        `/cashier/orders/${idPedido}/anular`,
        { motivo }
      );
      await Promise.all([loadOrders(), loadCaja()]);
      alert(data.message);
    } catch (err) {
      alert(err.response?.data?.error || "No se pudo anular el cobro.");
    }
  };

  // El endpoint del PDF exige token, así que no sirve window.open directo:
  // se descarga con axios (que adjunta el header) y se abre como blob.
  const abrirComprobante = async (idPedido) => {
    try {
      const { data } = await api.get(`/orders/${idPedido}/pdf`, {
        responseType: "blob",
      });

      const url = URL.createObjectURL(
        new Blob([data], { type: "application/pdf" })
      );
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error("No se pudo generar el comprobante PDF", err);
    }
  };

  const logout = async () => {
    await cerrarSesion();
    navigate("/");
  };

  // ===================== RENDER =====================
  return (
    <div className="min-h-screen bg-crema">
      <AppHeader titulo="Caja · Cuentas por cobrar" usuario={user} onLogout={logout} />

      <div className="mx-auto max-w-7xl p-4 sm:p-6">
      {/* ---------- BARRA DE TURNO DE CAJA ---------- */}
      {!cajaAbierta ? (
        <div className="bg-white border-l-4 border-yellow-500 p-4 rounded shadow mb-6">
          <h2 className="font-bold mb-1">Caja cerrada</h2>
          <p className="text-sm text-gray-600 mb-3">
            Debes aperturar la caja antes de poder cobrar.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              className="border rounded px-2 py-1"
              placeholder="Nombre de caja"
              value={aperturaForm.nombre_caja}
              onChange={(e) =>
                setAperturaForm({ ...aperturaForm, nombre_caja: e.target.value })
              }
            />

            <select
              className="border rounded px-2 py-1"
              value={aperturaForm.turno}
              onChange={(e) =>
                setAperturaForm({ ...aperturaForm, turno: e.target.value })
              }
            >
              <option>Mañana</option>
              <option>Tarde</option>
              <option>Noche</option>
            </select>

            <input
              className="border rounded px-2 py-1"
              type="number"
              step="0.01"
              placeholder="Saldo inicial"
              value={aperturaForm.saldo_inicial}
              onChange={(e) =>
                setAperturaForm({
                  ...aperturaForm,
                  saldo_inicial: e.target.value,
                })
              }
            />

            <button
              onClick={abrirCaja}
              className="bg-green-600 hover:bg-green-700 text-white rounded px-4 py-1.5 font-semibold"
            >
              Aperturar caja
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border-l-4 border-green-600 p-4 rounded shadow mb-6 flex flex-wrap justify-between items-center gap-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <div>
              <span className="text-gray-500 block text-xs">Caja</span>
              <strong>
                {caja?.nombre_caja} · {caja?.turno}
              </strong>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">Saldo inicial</span>
              <strong>{soles(caja?.saldo_inicial)}</strong>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">
                Ingresos del turno
              </span>
              <strong className="text-green-700">
                {soles(caja?.total_ingresos)}
              </strong>
            </div>
            <div>
              <span className="text-gray-500 block text-xs">Cobros</span>
              <strong>{caja?.cantidad_pagos ?? 0}</strong>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={anularCobro}
              className="border border-red-400 text-red-600 px-4 py-2 rounded text-sm"
            >
              Anular cobro
            </button>
            <button
              onClick={() => setMostrarCierre(true)}
              className="bg-gray-800 hover:bg-black text-white px-4 py-2 rounded text-sm font-semibold"
            >
              Cerrar caja
            </button>
          </div>
        </div>
      )}

      {/* ---------- RESUMEN DEL ÚLTIMO CIERRE ---------- */}
      {resumenCierre && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold mb-2">Cierre de caja registrado</h3>
              <div className="text-sm space-y-1">
                <div>Saldo inicial: {soles(resumenCierre.saldo_inicial)}</div>
                <div>Ingresos: {soles(resumenCierre.total_ingresos)}</div>
                <div>Egresos: {soles(resumenCierre.total_egresos)}</div>
                <div className="font-bold text-base pt-1">
                  Saldo final: {soles(resumenCierre.saldo_final)}
                </div>
              </div>
            </div>
            <button
              onClick={() => setResumenCierre(null)}
              className="text-gray-500 text-sm"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* ---------- MODAL DE CIERRE ---------- */}
      {mostrarCierre && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-1">Cerrar caja</h2>
            <p className="text-sm text-gray-600 mb-4">
              Ingresos acumulados: <strong>{soles(caja?.total_ingresos)}</strong>
            </p>

            <label className="block text-sm font-medium mb-1">
              Egresos del turno (gastos, retiros)
            </label>
            <input
              className="w-full border rounded px-3 py-2 mb-3"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={cierreForm.total_egresos}
              onChange={(e) =>
                setCierreForm({ ...cierreForm, total_egresos: e.target.value })
              }
            />

            <label className="block text-sm font-medium mb-1">
              Observación (opcional)
            </label>
            <textarea
              className="w-full border rounded px-3 py-2 mb-4"
              rows={3}
              value={cierreForm.observacion}
              onChange={(e) =>
                setCierreForm({ ...cierreForm, observacion: e.target.value })
              }
            />

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setMostrarCierre(false)}
                className="px-4 py-2 rounded border"
              >
                Cancelar
              </button>
              <button
                onClick={cerrarCaja}
                className="px-4 py-2 rounded bg-gray-800 text-white font-semibold"
              >
                Confirmar cierre
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- PEDIDOS POR COBRAR ---------- */}
      {loading ? (
        <p className="text-gray-500">Cargando pedidos...</p>
      ) : orders.length === 0 ? (
        <p className="text-gray-500 text-center mt-10">
          No hay mesas por cobrar.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {orders.map((o) => {
            const form = paymentData[o.id_pedido] || {};
            const esFactura = form.tipo_comprobante === "factura";
            const desc = Number(form.descuento || 0);
            const prop = Number(form.propina || 0);
            const totalCobrar = Number(o.total) - desc + prop;

            return (
              <div
                key={o.id_pedido}
                className="bg-white p-4 rounded shadow border-l-4 border-red-500 flex flex-col justify-between"
              >
                <div>
                  <h3 className="font-bold text-lg mb-1">Mesa {o.id_mesa}</h3>
                  <p className="text-xs text-gray-500 mb-2">
                    {o.fecha_creacion
                      ? new Date(o.fecha_creacion).toLocaleString("es-PE")
                      : "Sin fecha"}
                  </p>

                  {/* Si hay ajustes, se muestra el desglose */}
                  {(desc > 0 || prop > 0) && (
                    <div className="text-xs text-gray-500 text-right space-y-0.5 mt-2">
                      <div>Consumo: {soles(o.total)}</div>
                      {desc > 0 && (
                        <div className="text-red-600">
                          Descuento: −{soles(desc)}
                        </div>
                      )}
                      {prop > 0 && (
                        <div className="text-green-600">
                          Propina: +{soles(prop)}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-3xl font-bold text-right my-2 text-gray-800">
                    {soles(totalCobrar)}
                  </div>

                  <div className="space-y-2 text-sm">
                    <select
                      className="w-full border rounded px-2 py-1"
                      value={form.metodo_pago || "Efectivo"}
                      onChange={(e) =>
                        handleChangePaymentField(
                          o.id_pedido,
                          "metodo_pago",
                          e.target.value
                        )
                      }
                    >
                      <option>Efectivo</option>
                      <option>Tarjeta</option>
                      <option>Yape</option>
                      <option>Plin</option>
                    </select>

                    <select
                      className="w-full border rounded px-2 py-1"
                      value={form.tipo_comprobante || "boleta"}
                      onChange={(e) =>
                        handleChangePaymentField(
                          o.id_pedido,
                          "tipo_comprobante",
                          e.target.value
                        )
                      }
                    >
                      <option value="boleta">Boleta</option>
                      <option value="factura">Factura</option>
                    </select>

                    <input
                      className="w-full border rounded px-2 py-1"
                      placeholder={
                        esFactura ? "Razón social (obligatorio)" : "Nombre del cliente"
                      }
                      value={form.nombre_cliente || ""}
                      onChange={(e) =>
                        handleChangePaymentField(
                          o.id_pedido,
                          "nombre_cliente",
                          e.target.value
                        )
                      }
                    />

                    <input
                      className="w-full border rounded px-2 py-1"
                      placeholder={
                        esFactura ? "RUC (11 dígitos)" : "DNI (opcional, 8 dígitos)"
                      }
                      value={form.doc_cliente || ""}
                      onChange={(e) =>
                        handleChangePaymentField(
                          o.id_pedido,
                          "doc_cliente",
                          e.target.value
                        )
                      }
                    />

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className="w-full border rounded px-2 py-1"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Descuento"
                        value={form.descuento || ""}
                        onChange={(e) =>
                          handleChangePaymentField(
                            o.id_pedido,
                            "descuento",
                            e.target.value
                          )
                        }
                      />
                      <input
                        className="w-full border rounded px-2 py-1"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Propina"
                        value={form.propina || ""}
                        onChange={(e) =>
                          handleChangePaymentField(
                            o.id_pedido,
                            "propina",
                            e.target.value
                          )
                        }
                      />
                    </div>

                    <p className="text-xs text-gray-400">
                      El número de comprobante se genera automáticamente.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => payOrder(o)}
                  disabled={!cajaAbierta}
                  className="mt-4 w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white p-2 rounded font-bold"
                  title={cajaAbierta ? "" : "Apertura la caja para poder cobrar"}
                >
                  COBRAR
                </button>
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
