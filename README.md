# 🍩 La Casita del Picarón — Sistema de Comandas

Sistema de gestión de pedidos (POS) para restaurante, con roles diferenciados,
comunicación en tiempo real y flujo completo de venta hasta la emisión de
comprobantes y el cierre de caja.

> Proyecto del curso **Desarrollo de Aplicaciones Web (DAW)**.

**Demo en producción:** https://lacasita-frontend.onrender.com

---

## 📋 Descripción

La aplicación digitaliza el circuito de atención de un restaurante:

```
MOZO toma el pedido  →  COCINA lo prepara  →  MOZO lo sirve
     →  CAJA cobra y emite comprobante  →  arqueo de caja
```

Cada rol tiene su propia vista, y todas se sincronizan en tiempo real: cuando el
mozo confirma un pedido, aparece al instante en cocina; cuando cocina lo marca
listo, el mozo recibe el aviso; al cobrar, la mesa se libera automáticamente.

---

## ✨ Funcionalidades

### Por rol

| Rol | Puede |
|---|---|
| **Mozo** | Ver mesas, tomar y acumular pedidos, añadir notas por platillo, marcar servido, enviar a caja, anular |
| **Cocina** | Ver la cola de pedidos con tiempos de espera (semáforo), notas del mozo, marcar listo |
| **Caja** | Aperturar/cerrar turno, cobrar con descuento y propina, emitir boleta/factura, anular cobros, arqueo |
| **Admin** | Gestionar carta y personal, ver reportes de ventas, bitácora de accesos e historial de cierres |

### Transversales

- **Autenticación JWT** con expiración, bloqueo tras 5 intentos fallidos y *rate limiting*.
- **Comprobantes** boleta/factura con correlativo automático por serie (`B001-…`, `F001-…`) y desglose de IGV.
- **Cierre de caja** con arqueo: `saldo_final = saldo_inicial + ingresos − egresos`.
- **Anulaciones** de pedidos y de cobros, conservando la trazabilidad (nada se borra).
- **Tiempo real** por Socket.IO con salas por rol (cada evento llega solo a quien le incumbe).
- **Reportes** diario, por rango, mensual, anual y ranking de platillos más vendidos.

---

## 🛠️ Tecnologías

**Backend**
- Node.js + Express 5
- PostgreSQL (driver `pg`) con una capa de compatibilidad estilo mysql2
- JWT (`jsonwebtoken`) + `bcryptjs`
- Socket.IO
- `helmet` + `express-rate-limit`
- `pdfkit` (generación de comprobantes en PDF)

**Frontend**
- React 19 + Vite
- React Router
- Tailwind CSS
- Axios + socket.io-client

**Infraestructura**
- Render (Web Service + Static Site + PostgreSQL) vía Blueprint (`render.yaml`)

---

## 📁 Estructura

```
Daw/
├── render.yaml                 # Blueprint de despliegue (3 servicios)
├── README.md                   # Este archivo
├── README-DEPLOY.md            # Guía paso a paso de despliegue en Render
│
├── backend/
│   ├── index.js                # Servidor Express + Socket.IO
│   ├── config/db.js            # Pool de PostgreSQL + shim mysql2 + transacciones
│   ├── controllers/            # Lógica por dominio (auth, orders, cashier, …)
│   ├── routes/                 # Definición de endpoints y permisos
│   ├── middlewares/            # authenticateToken, requireRole
│   ├── utils/                  # pedidoItems, comprobante, calculos, pdfGenerator
│   ├── tests/                  # Pruebas (node:test)
│   ├── migrations/             # Historial de evolución del esquema (001–004)
│   └── schema.postgres.sql     # Esquema completo (estado final)
│
└── frontend/
    ├── index.html
    ├── tailwind.config.js      # Paleta de marca
    └── src/
        ├── api/                # axios (con interceptor 401) y socket
        ├── components/         # AppHeader, ProtectedRoute, CambiarPassword…
        ├── pages/              # Login, WaiterPanel, KitchenPanel, CashierPanel, AdminPanel
        └── utils/              # auth (sesión), logout
```

---

## 🗄️ Modelo de datos

Núcleo del modelo (11 tablas):

- **`personal`** — usuarios del sistema (mozo, cocina, caja, admin).
- **`mesa`** — mesas del local y su estado.
- **`platillo`** — carta del restaurante.
- **`pedidos`** — cabecera del pedido (estado, total, cliente, cobro).
- **`detalle_comanda`** — líneas del pedido (FK a `pedidos` y `platillo`).
- **`pago`** / **`comprobante_pago`** — cobro y comprobante emitido.
- **`caja`** / **`reportecierre`** — turnos de caja y arqueos.
- **`cliente`** — clientes normalizados por documento.
- **`logsesion`** — bitácora de accesos.

> El detalle del pedido está **normalizado** en `detalle_comanda` (una fila por
> línea, con integridad referencial), en lugar de guardarse como JSON dentro del
> pedido. Esto permite consultar lo vendido con SQL y garantiza la consistencia.

---

## 🚀 Puesta en marcha (local)

### Requisitos
- Node.js 18+
- PostgreSQL 16/17/18

### 1. Base de datos

```bash
createdb lacasitadpicaron
psql "postgres://usuario:clave@localhost:5432/lacasitadpicaron" -f backend/schema.postgres.sql
```

### 2. Backend

```bash
cd backend
cp .env.example .env      # y completa los valores (ver abajo)
npm install
npm run dev               # http://localhost:3000
```

`.env` mínimo:

```env
DATABASE_URL=postgres://usuario:clave@localhost:5432/lacasitadpicaron
PORT=3000
FRONTEND_URL=http://localhost:5173
SECRET_KEY=una_clave_larga_y_aleatoria
ENABLE_DEV_ROUTES=true     # solo para sembrar; luego ponlo en false
```

### 3. Sembrar datos iniciales

Con el backend corriendo y `ENABLE_DEV_ROUTES=true`, visita una vez:

- `http://localhost:3000/api/dev/seed-users` → crea 4 usuarios (contraseña `1234`)
- `http://localhost:3000/api/dev/seed-data` → crea 10 mesas y 6 platillos

Luego pon `ENABLE_DEV_ROUTES=false`.

### 4. Frontend

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```

---

## 👤 Usuarios de prueba

| Código de acceso | Rol | Contraseña |
|---|---|---|
| `admin` | Admin | `1234` |
| `mozo1` | Mozo | `1234` |
| `cocina1` | Cocina | `1234` |
| `caja1` | Caja | `1234` |

> Cámbialas tras el primer inicio de sesión.

---

## 🧪 Pruebas

```bash
cd backend
npm test
```

Cubren la lógica de negocio crítica: numeración de comprobantes (correlativos,
series, relleno de dígitos, entradas corruptas) y cálculos del cobro
(descuento, propina, desglose de IGV, casos inválidos).

---

## ☁️ Despliegue

El despliegue en Render está documentado paso a paso en
[README-DEPLOY.md](README-DEPLOY.md). En resumen: `render.yaml` crea los tres
servicios; se carga `schema.postgres.sql` en la base y se completan las URLs
cruzadas entre frontend y backend.

---

## 🔐 Seguridad

- Contraseñas almacenadas con hash `bcrypt`.
- Rutas protegidas por token y por rol en el backend (la protección del
  frontend es solo comodidad de interfaz).
- `SECRET_KEY` obligatoria: el servidor no arranca sin ella.
- Las rutas de siembra (`/api/dev`) solo se activan con `ENABLE_DEV_ROUTES=true`.
