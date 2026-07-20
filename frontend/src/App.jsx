// frontend/src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Login from "./pages/Login";
import WaiterPanel from "./pages/WaiterPanel";
import KitchenPanel from "./pages/KitchenPanel";
import CashierPanel from "./pages/CashierPanel";
import AdminPanel from "./pages/AdminPanel";
import ProtectedRoute from "./components/ProtectedRoute";

import "./App.css";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />

        {/* Vista única del mozo (mesas + comanda) */}
        <Route
          path="/waiter"
          element={
            <ProtectedRoute roles={["Mozo", "Admin"]}>
              <WaiterPanel />
            </ProtectedRoute>
          }
        />

        <Route
          path="/kitchen"
          element={
            <ProtectedRoute roles={["Cocina", "Admin"]}>
              <KitchenPanel />
            </ProtectedRoute>
          }
        />

        <Route
          path="/cashier"
          element={
            <ProtectedRoute roles={["Caja", "Admin"]}>
              <CashierPanel />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={["Admin"]}>
              <AdminPanel />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
