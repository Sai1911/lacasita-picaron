// frontend/src/pages/WaiterPanel.jsx
import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";
import socket, { conectarSocket } from "../api/socket";
import { resolveUser } from "../utils/auth";
import { cerrarSesion } from "../utils/logout";
import CambiarPassword from "../components/CambiarPassword";

export default function WaiterPanel() {
  const location = useLocation();
  const navigate = useNavigate();

  // Sobrevive a un F5: si no viene por navegación, se lee de localStorage.
  const user = resolveUser(location.state?.user);

  const [tables, setTables] = useState([]);
  const [menuByCat, setMenuByCat] = useState({});
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedTable, setSelectedTable] = useState(null);

  const [currentOrder, setCurrentOrder] = useState(null);
  const [newItems, setNewItems] = useState([]);

  const [notification, setNotification] = useState("");

  // ===================== CARGA INICIAL =====================
  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }
    loadTables();
    loadMenu();
  }, [user, navigate]);

  // ===================== SOCKETS =====================
  useEffect(() => {
    conectarSocket();

    const handleOrderReady = ({ tableId }) => {
      setNotification(`Pedido de la mesa ${tableId} está LISTO en cocina.`);
      loadTables();
      if (selectedTable && selectedTable.id_mesa === tableId) {
        loadCurrentOrder(tableId);
      }
    };

    const handleOrderPaid = ({ tableId }) => {
      setNotification(`La mesa ${tableId} ha sido pagada y liberada.`);
      loadTables();
      if (selectedTable && selectedTable.id_mesa === tableId) {
        setSelectedTable(null);
        setCurrentOrder(null);
        setNewItems([]);
      }
    };

    socket.on("orderReady", handleOrderReady);
    socket.on("orderPaid", handleOrderPaid);

    return () => {
      socket.off("orderReady", handleOrderReady);
      socket.off("orderPaid", handleOrderPaid);
    };
  }, [selectedTable]);

  // ===================== CARGAR MESAS =====================
  const loadTables = async () => {
    try {
      const { data } = await api.get("/tables");
      setTables(data);
    } catch (err) {
      console.error("Error cargando mesas", err);
    }
  };

  // ===================== CARGAR MENÚ =====================
  const loadMenu = async () => {
    try {
      const { data } = await api.get("/menu");

      // El backend devuelve los campos con alias en inglés:
      // { id, name, description, category, price, disponibilidad }
      // El mozo solo debe ver los platillos disponibles.
      const grouped = data
        .filter((item) => Number(item.disponibilidad) === 1)
        .reduce((acc, item) => {
          const cat = item.category || "Sin categoría";
          if (!acc[cat]) acc[cat] = [];

          acc[cat].push({
            id_platillo: item.id,
            name: item.name,
            price: Number(item.price),
            descripcion: item.description,
          });

          return acc;
        }, {});

      setMenuByCat(grouped);
      const cats = Object.keys(grouped);
      setSelectedCategory(cats[0] || "");
    } catch (err) {
      console.error("Error cargando menú", err);
    }
  };

  // ===================== CARGAR PEDIDO ACTUAL =====================
  const loadCurrentOrder = async (mesaId) => {
    try {
      const { data } = await api.get(`/tables/${mesaId}/current-order`);
      console.log("current-order mesa", mesaId, data);
      setCurrentOrder(data);
    } catch (err) {
      console.error("Error cargando pedido actual", err);
    }
  };

  // ===================== SELECCIONAR MESA =====================
  const handleTableClick = async (mesa) => {
    setSelectedTable(mesa);
    setNewItems([]);
    await loadCurrentOrder(mesa.id_mesa);
  };

  // ===================== AÑADIR ITEMS =====================
  const addItem = (item) => {
    setNewItems((prev) => {
      const existing = prev.find(
        (n) => n.id_platillo === item.id_platillo
      );

      if (existing) {
        return prev.map((n) =>
          n.id_platillo === item.id_platillo
            ? { ...n, quantity: n.quantity + 1 }
            : n
        );
      }

      return [
        ...prev,
        {
          id_platillo: item.id_platillo,
          name: item.name,
          price: Number(item.price),
          quantity: 1,
          nota: "",
        },
      ];
    });
  };

  // Indicación para cocina de un platillo del carrito
  const updateItemNota = (id_platillo, nota) => {
    setNewItems((prev) =>
      prev.map((item) =>
        item.id_platillo === id_platillo ? { ...item, nota } : item
      )
    );
  };

  const updateItemQuantity = (id_platillo, delta) => {
    setNewItems((prev) =>
      prev
        .map((item) =>
          item.id_platillo === id_platillo
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const clearNewItems = () => setNewItems([]);

  const calcTotal = (items) =>
    items.reduce((sum, i) => sum + Number(i.price) * i.quantity, 0);

  // ===================== CONFIRMAR PEDIDO =====================
  const confirmOrder = async () => {
    if (!newItems.length || !selectedTable) return;

    console.log("ENVIANDO ITEMS:", newItems);

    try {
      await api.post("/orders", {
        tableId: selectedTable.id_mesa,
        waiterId: user.id_personal,
        items: newItems.map((i) => ({
          id_platillo: i.id_platillo,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
          nota: i.nota || "",
        })),
        total: calcTotal(newItems),
      });

      setNewItems([]);
      await loadCurrentOrder(selectedTable.id_mesa);
      await loadTables();
      setNotification("Pedido enviado a cocina.");
    } catch (err) {
      console.error("Error enviando pedido", err);
      setNotification("Error enviando pedido.");
    }
  };

  // ===================== MARCAR SERVIDO =====================
  const markServed = async () => {
    if (!currentOrder?.id_pedido) return;

    try {
      await api.put(`/orders/${currentOrder.id_pedido}/served`);
      setNotification("Pedido entregado en la mesa.");
      await loadCurrentOrder(selectedTable.id_mesa);
    } catch (err) {
      setNotification(
        err.response?.data?.error || "No se pudo marcar como servido."
      );
    }
  };

  // ===================== ANULAR PEDIDO =====================
  const cancelOrder = async () => {
    if (!currentOrder?.id_pedido) return;

    const motivo = window.prompt(
      "Motivo de la anulación (obligatorio):"
    );
    if (!motivo) return;

    try {
      await api.put(`/orders/${currentOrder.id_pedido}/cancel`, { motivo });
      setNotification("Pedido anulado.");
      setCurrentOrder(null);
      setNewItems([]);
      await loadTables();
      await loadCurrentOrder(selectedTable.id_mesa);
    } catch (err) {
      setNotification(
        err.response?.data?.error || "No se pudo anular el pedido."
      );
    }
  };

  // ===================== FINALIZAR PEDIDO =====================
  const finishOrder = async () => {
    if (!selectedTable) return;

    try {
      await api.put(`/orders/table/${selectedTable.id_mesa}/finish`);
      setNotification("Pedido enviado a CAJA para cobro.");
      await loadTables();
      await loadCurrentOrder(selectedTable.id_mesa);
    } catch (err) {
      console.error("Error finalizando pedido", err);
      console.error("Detalles del error:", err.response?.data);

      if (err.response?.status === 403) {
        setNotification(`Error 403: ${err.response.data.message || 'No autorizado'}. Intenta cerrar sesión y volver a iniciar.`);
      } else {
        setNotification("Error al enviar pedido a CAJA.");
      }
    }
  };

  // ===================== VISTA: MESAS =====================
  if (!selectedTable) {
    return (
      <div className="p-6 min-h-screen bg-gray-100">
        {notification && (
          <div className="bg-blue-100 text-blue-800 text-center p-2 rounded mb-3">
            {notification}
          </div>
        )}

        <header className="flex justify-between mb-6">
          <h1 className="text-xl font-bold">
            Mesas – Mozo {user?.nombre || ""}
          </h1>

          <div className="flex items-center gap-3">
          <CambiarPassword />
          <button
            onClick={async () => {
              await cerrarSesion();
              navigate("/");
            }}
            className="bg-red-600 px-4 py-2 text-white rounded"
          >
            Cerrar sesión
          </button>
          </div>
        </header>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {tables.map((mesa) => (
            <div
              key={mesa.id_mesa}
              onClick={() => handleTableClick(mesa)}
              className={`p-4 rounded shadow cursor-pointer text-center transition 
                ${
                  mesa.estado === "Ocupada"
                    ? "bg-orange-300"
                    : mesa.estado === "Por pagar"
                    ? "bg-red-400"
                    : "bg-green-300"
                }`}
            >
              <h2 className="font-bold text-lg">Mesa {mesa.numero_mesa}</h2>
              <p className="text-sm">{mesa.estado}</p>
              {mesa.mozo_asignado && (
                <p className="text-xs mt-1 opacity-75">
                  {mesa.id_personal_asignado === user?.id_personal
                    ? "Tu mesa"
                    : `Atiende: ${mesa.mozo_asignado}`}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ===================== VISTA: COMANDA =====================
  const categories = Object.keys(menuByCat);
  const itemsToShow =
    selectedCategory && menuByCat[selectedCategory]
      ? menuByCat[selectedCategory]
      : [];

  return (
    <div className="p-6 min-h-screen bg-gray-100">
      {notification && (
        <div className="bg-blue-100 text-blue-800 text-center p-2 rounded mb-3">
          {notification}
        </div>
      )}

      <div className="flex justify-between items-center mb-4">
        <button
          onClick={() => {
            setSelectedTable(null);
            setCurrentOrder(null);
            setNewItems([]);
          }}
          className="bg-gray-700 text-white px-4 py-2 rounded"
        >
          Volver a Mesas
        </button>

        <h1 className="text-xl font-bold">
          Mesa {selectedTable.numero_mesa} – Mozo {user?.nombre}
        </h1>

        <button
          onClick={async () => {
            await cerrarSesion();
            navigate("/");
          }}
          className="bg-red-600 text-white px-4 py-2 rounded"
        >
          Cerrar sesión
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* MENÚ */}
        <section className="lg:col-span-2 bg-white p-4 rounded shadow">
          <h2 className="text-xl font-bold mb-3 text-center">Menú</h2>

          <div className="flex flex-wrap gap-2 justify-center mb-4">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full border ${
                  selectedCategory === cat
                    ? "bg-orange-500 text-white border-orange-500"
                    : "bg-white text-gray-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {itemsToShow.length === 0 ? (
            <p className="text-sm text-gray-500 text-center">
              No hay platillos registrados en esta categoría.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {itemsToShow.map((item) => (
                <div
                  key={item.id_platillo}
                  className="border rounded p-3 shadow cursor-pointer hover:bg-gray-100"
                  onClick={() => addItem(item)}
                >
                  <h4 className="font-semibold">{item.name}</h4>
                  <p className="text-sm text-gray-500">
                    {item.descripcion || "Sin descripción"}
                  </p>
                  <p className="text-orange-600 font-bold mt-1">
                    S/ {Number(item.price).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* PEDIDO */}
        <section className="bg-white p-4 rounded shadow flex flex-col">
          <h2 className="text-lg font-bold mb-3 text-center">
            Pedido de la mesa
          </h2>

          {/* Pedido actual */}
          <div className="border-b pb-3 mb-3">
            <h3 className="font-semibold mb-2">Pedido actual</h3>
            {currentOrder &&
            Array.isArray(currentOrder.items) &&
            currentOrder.items.length ? (
              <>
                {currentOrder.items.map((i, idx) => (
                  <div key={`${i.id_platillo}-${idx}`} className="mb-1">
                    <div className="flex justify-between text-sm">
                      <span>
                        {i.quantity} x {i.name}
                      </span>
                      <span>
                        S/ {(Number(i.price ?? 0) * i.quantity).toFixed(2)}
                      </span>
                    </div>
                    {i.nota && (
                      <p className="text-xs text-orange-600 italic">
                        ↳ {i.nota}
                      </p>
                    )}
                  </div>
                ))}
                <p className="font-bold mt-2 text-right">
                  Total actual: S/ {Number(currentOrder.total).toFixed(2)}
                </p>

                {/* El mozo confirma la entrega solo cuando cocina lo dejó listo */}
                {currentOrder.estado === "listo" && (
                  <button
                    onClick={markServed}
                    className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white py-1.5 rounded text-sm"
                  >
                    Marcar como servido
                  </button>
                )}

                {currentOrder.estado === "servido" && (
                  <p className="text-xs text-center text-blue-600 mt-2">
                    ✓ Entregado en la mesa
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-gray-500">
                No hay pedido registrado.
              </p>
            )}
          </div>

          {/* Nuevos items */}
          <div className="flex-1 flex flex-col">
            <h3 className="font-semibold mb-2">Nuevos platillos</h3>

            {newItems.length === 0 ? (
              <p className="text-sm text-gray-500">
                No has agregado nuevos platillos.
              </p>
            ) : (
              <>
                {newItems.map((i) => (
                  <div key={i.id_platillo} className="mb-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="flex-1">{i.name}</span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            updateItemQuantity(i.id_platillo, -1)
                          }
                          className="w-6 h-6 rounded-full border flex items-center justify-center"
                        >
                          -
                        </button>

                        <span>{i.quantity}</span>

                        <button
                          onClick={() =>
                            updateItemQuantity(i.id_platillo, 1)
                          }
                          className="w-6 h-6 rounded-full border flex items-center justify-center"
                        >
                          +
                        </button>

                        <span className="w-16 text-right">
                          S/ {(i.price * i.quantity).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Indicación para cocina */}
                    <input
                      className="w-full mt-1 border rounded px-2 py-1 text-xs"
                      placeholder="Nota para cocina (ej. sin cebolla)"
                      value={i.nota || ""}
                      onChange={(e) =>
                        updateItemNota(i.id_platillo, e.target.value)
                      }
                    />
                  </div>
                ))}

                <p className="font-bold mt-2 text-right">
                  Total nuevos: S/ {calcTotal(newItems).toFixed(2)}
                </p>
              </>
            )}

            <div className="mt-auto space-y-2 pt-3">
              <button
                onClick={confirmOrder}
                disabled={!newItems.length}
                className="w-full bg-green-600 disabled:opacity-50 text-white py-2 rounded"
              >
                Confirmar pedido
              </button>

              <button
                onClick={clearNewItems}
                disabled={!newItems.length}
                className="w-full border border-gray-300 py-2 rounded"
              >
                Limpiar selección
              </button>

              <button
                onClick={finishOrder}
                className="w-full bg-red-600 text-white py-2 rounded"
              >
                Finalizar pedido (Caja)
              </button>

              {currentOrder?.id_pedido && (
                <button
                  onClick={cancelOrder}
                  className="w-full border border-red-400 text-red-600 py-2 rounded text-sm"
                >
                  Anular pedido
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
