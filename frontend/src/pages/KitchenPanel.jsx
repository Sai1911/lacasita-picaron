// frontend/src/pages/KitchenPanel.jsx
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";
import socket, { conectarSocket } from "../api/socket";
import { resolveUser } from "../utils/auth";
import { cerrarSesion } from "../utils/logout";
import CambiarPassword from "../components/CambiarPassword";

const KitchenPanel = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Sobrevive a un F5: si no viene por navegación, se lee de localStorage.
  const user = resolveUser(location.state?.user);

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // Reloj propio: obliga a repintar cada 30s para que los minutos
  // de espera avancen aunque no lleguen pedidos nuevos.
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Minutos que lleva esperando un pedido
  const minutosEspera = (fecha) => {
    if (!fecha) return 0;
    return Math.max(0, Math.floor((ahora - new Date(fecha).getTime()) / 60000));
  };

  // Verde <10 min · ámbar 10-20 · rojo >20
  const nivelDemora = (min) =>
    min > 20 ? "rojo" : min > 10 ? "ambar" : "normal";

  const fetchPendingOrders = async () => {
    try {
      setErrorMsg("");
      const res = await api.get("/kitchen/orders");
      setOrders(res.data || []);
    } catch (err) {
      console.error("Error getPendingOrders:", err);
      setErrorMsg("No se pudieron cargar los pedidos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }

    conectarSocket();
    fetchPendingOrders();

    // El backend emite "newOrder" a la sala "Cocina" cuando el mozo
    // confirma un pedido. Se mantiene un refresco periódico (más lento)
    // como red de seguridad por si se pierde la conexión del socket.
    const handleNewOrder = () => fetchPendingOrders();
    const handleCancelled = () => fetchPendingOrders();

    socket.on("newOrder", handleNewOrder);
    socket.on("orderCancelled", handleCancelled);

    const interval = setInterval(fetchPendingOrders, 30000);

    return () => {
      socket.off("newOrder", handleNewOrder);
      socket.off("orderCancelled", handleCancelled);
      clearInterval(interval);
    };
  }, [user, navigate]);

  const handleMarkReady = async (orderId) => {
    try {
      await api.put(`/kitchen/orders/${orderId}/ready`);
      setOrders((prev) => prev.filter((o) => o.id_pedido !== orderId));
      window.alert("Pedido marcado como listo");
    } catch (err) {
      console.error("Error markReady:", err);
      window.alert("Ocurrió un error al marcar el pedido como listo");
    }
  };

  const handleLogout = async () => {
    await cerrarSesion();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* HEADER */}
      <header className="bg-[#111827] text-white flex items-center justify-between px-6 py-3 shadow">
        <span className="text-orange-500 font-bold text-lg">
          La Casita del Picarón - Cocina
        </span>
        <div className="flex items-center space-x-4">
          <span className="text-sm">
            {user ? `${user.nombre} (${user.rol || "Cocina"})` : "Cocina"}
          </span>
          <div className="bg-white/10 px-2 py-1 rounded">
            <CambiarPassword />
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-1.5 rounded"
          >
            Salir
          </button>
        </div>
      </header>

      {/* CONTENIDO */}
      <main className="flex-1 p-6">
        <h1 className="text-xl font-semibold mb-4 text-center">
          Pedidos Pendientes
        </h1>

        {loading ? (
          <div className="text-gray-500 text-center">Cargando pedidos...</div>
        ) : errorMsg ? (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded text-center">
            {errorMsg}
          </div>
        ) : orders.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
            No hay pedidos pendientes.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {orders.map((order) => {
              const min = minutosEspera(order.fecha_creacion);
              const nivel = nivelDemora(min);

              const borde =
                nivel === "rojo"
                  ? "border-red-500 border-2"
                  : nivel === "ambar"
                  ? "border-amber-400 border-2"
                  : "border-gray-200";

              const chip =
                nivel === "rojo"
                  ? "bg-red-100 text-red-700"
                  : nivel === "ambar"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-gray-100 text-gray-600";

              return (
              <div
                key={order.id_pedido}
                className={`bg-white rounded-lg shadow flex flex-col ${borde}`}
              >
                <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                  <div className="font-semibold text-gray-800">
                    Mesa {order.mesa || order.id_mesa}
                  </div>
                  <div className={`text-xs font-semibold px-2 py-1 rounded-full ${chip}`}>
                    {nivel === "rojo" && "⚠ "}
                    {min} min
                  </div>
                </div>

                <div className="px-4 py-3 flex-1">
                  {Array.isArray(order.items) && order.items.length > 0 ? (
                    <ul className="space-y-1 text-sm">
                      {order.items.map((item, idx) => (
                        <li key={`${order.id_pedido}-${idx}`}>
                          <div className="flex justify-between">
                            <span>
                              <span className="font-semibold mr-1">
                                {item.quantity}x
                              </span>
                              {item.name}
                            </span>
                            <span className="text-gray-700">
                              S/{" "}
                              {(
                                Number(item.price || 0) * item.quantity
                              ).toFixed(2)}
                            </span>
                          </div>
                          {/* Indicación del mozo: destacada para que no se pase por alto */}
                          {item.nota && (
                            <div className="mt-0.5 text-xs font-semibold text-orange-700 bg-orange-50 border-l-2 border-orange-400 px-2 py-0.5">
                              ↳ {item.nota}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Sin detalle de platos.
                    </p>
                  )}
                </div>

                <div className="px-4 py-3 border-t border-gray-100">
                  <button
                    onClick={() => handleMarkReady(order.id_pedido)}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 rounded"
                  >
                    PEDIDO LISTO
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default KitchenPanel;
