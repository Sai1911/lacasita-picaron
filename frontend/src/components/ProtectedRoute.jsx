import { Navigate, useLocation } from "react-router-dom";
import { getToken, getUser } from "../utils/auth";

// Envuelve una vista para que solo sea accesible con sesión iniciada
// y con uno de los roles permitidos.
//
// Ojo: esto es comodidad de interfaz, NO seguridad real. La seguridad
// la impone el backend (authenticateToken + requireRole); aquí solo
// evitamos mostrar pantallas que de todos modos no funcionarían.
export default function ProtectedRoute({ roles, children }) {
  const location = useLocation();
  const token = getToken();
  const user = getUser();

  // Sin sesión → al login
  if (!token || !user) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  // Con sesión pero rol equivocado → a su propio panel
  if (roles && !roles.includes(user.rol)) {
    return <Navigate to={rutaPorRol(user.rol)} replace />;
  }

  return children;
}

export function rutaPorRol(rol) {
  switch (rol) {
    case "Mozo":
      return "/waiter";
    case "Cocina":
      return "/kitchen";
    case "Caja":
      return "/cashier";
    case "Admin":
      return "/admin";
    default:
      return "/";
  }
}
