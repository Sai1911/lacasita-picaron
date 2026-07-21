import CambiarPassword from "./CambiarPassword";

// Cabecera de marca compartida por todos los paneles.
// Antes cada panel tenía su propio encabezado con estilos distintos.
//
// props:
//   titulo   → nombre de la vista ("Cocina", "Caja"...)
//   usuario  → objeto con { nombre, rol }
//   onLogout → función de cierre de sesión
//   right    → contenido extra opcional a la derecha (botones de la vista)
export default function AppHeader({ titulo, usuario, onLogout, right }) {
  return (
    <header className="sticky top-0 z-40 bg-carbon text-white shadow-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        {/* Marca + título de la vista */}
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-2xl">🍩</span>
          <div className="leading-tight min-w-0">
            <div className="font-logo text-lg text-brand-300 truncate">
              La Casita del Picarón
            </div>
            {titulo && (
              <div className="text-xs text-white/60 -mt-0.5 truncate">
                {titulo}
              </div>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex items-center gap-2 sm:gap-3">
          {right}

          {usuario && (
            <span className="hidden sm:inline text-sm text-white/70">
              {usuario.nombre}
              {usuario.rol ? ` · ${usuario.rol}` : ""}
            </span>
          )}

          <div className="[&_button]:text-white/70 [&_button:hover]:text-white">
            <CambiarPassword />
          </div>

          <button
            onClick={onLogout}
            className="rounded-lg bg-terracota-600 px-3 py-1.5 text-sm
                       font-semibold hover:bg-terracota-700 transition"
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
