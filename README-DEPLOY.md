# Despliegue en Render — La Casita del Picarón

Guía paso a paso para publicar el proyecto (backend Express + frontend React/Vite + PostgreSQL).

---

## 1. Subir el proyecto a GitHub

Render despliega desde un repositorio. Desde la carpeta raíz (`Daw/`):

```bash
git init
git add .
git commit -m "Preparar proyecto para despliegue en Render"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git
git push -u origin main
```

> ⚠️ Antes de hacer commit, confirma que `backend/.env` **no** aparece en `git status`.
> El archivo `backend/.gitignore` ya lo excluye, pero verifícalo: contiene tu clave JWT.

---

## 2. Crear los servicios en Render

En Render: **New +** → **Blueprint** → conecta tu repositorio.

Render leerá el archivo `render.yaml` de la raíz y creará automáticamente:

| Servicio | Tipo | Descripción |
|---|---|---|
| `lacasita-db` | PostgreSQL | Base de datos |
| `lacasita-backend` | Web Service | API Express |
| `lacasita-frontend` | Static Site | Interfaz React |

El `DATABASE_URL` y el `SECRET_KEY` se configuran solos.

---

## 3. Cargar el esquema de la base de datos

Una vez creada la BD, copia su **External Database URL** desde el panel de Render y ejecuta:

```bash
psql "URL_EXTERNA_DE_LA_BD" -f backend/schema.postgres.sql
```

> Si no tienes `psql` instalado, puedes pegar el contenido de
> `backend/schema.postgres.sql` en la consola web de PostgreSQL que ofrece Render.

> ✅ **Para un despliegue nuevo, esto es todo.** `schema.postgres.sql` ya
> refleja el estado final del modelo (detalle normalizado, sin la tabla
> `comanda`, con todas las columnas de cobro y anulación). **No** ejecutes
> las migraciones: son solo para actualizar una base creada con una versión
> anterior del esquema, como la que corre en tu equipo local.
>
> La carpeta `backend/migrations/` documenta cómo evolucionó el modelo
> (útil como historial para la evaluación), pero un servidor nuevo nace ya
> con el esquema completo.

---

## 4. Conectar frontend y backend (variables cruzadas)

Estas variables no se pueden autocompletar porque dependen de las URLs que Render
asigna después del primer despliegue. Complétalas a mano:

**En `lacasita-backend` → Environment:**

| Variable | Valor |
|---|---|
| `FRONTEND_URL` | `https://lacasita-frontend.onrender.com` |

**En `lacasita-frontend` → Environment:**

| Variable | Valor |
|---|---|
| `VITE_API_URL` | `https://lacasita-backend.onrender.com/api` |
| `VITE_SOCKET_URL` | `https://lacasita-backend.onrender.com` |

> Usa las URLs reales que te muestre Render. Tras guardarlas, haz
> **Manual Deploy → Clear build cache & deploy** en el frontend
> (las variables `VITE_` se incrustan durante el build, no en runtime).

---

## 5. Crear los datos iniciales

Con el backend ya desplegado, visita **una sola vez** en el navegador:

1. `https://lacasita-backend.onrender.com/api/dev/seed-users`
   → crea 4 usuarios. Contraseña para todos: `1234`

   | Código de acceso | Rol |
   |---|---|
   | `admin` | Admin |
   | `mozo1` | Mozo |
   | `cocina1` | Cocina |
   | `caja1` | Caja |

2. `https://lacasita-backend.onrender.com/api/dev/seed-data`
   → crea 10 mesas y 6 platillos de ejemplo.

> 🔒 **Importante:** estas rutas no tienen autenticación. Solo funcionan si
> la variable `ENABLE_DEV_ROUTES` vale `"true"`. Ponla en `true` en Render,
> ejecuta los dos seeds, y **vuelve a ponerla en `false`** (el servicio se
> reinicia solo). No hace falta tocar el código.

---

## 6. Flujo de operación (importante)

El sistema exige que la caja esté **aperturada** para poder cobrar. El circuito completo es:

1. **Caja** entra al sistema y apertura el turno indicando nombre, turno y saldo inicial.
2. **Mozo** selecciona una mesa, arma el pedido y lo confirma → llega a cocina.
3. **Cocina** ve el pedido y lo marca como *listo* → el mozo recibe el aviso.
4. **Mozo** pulsa "Finalizar pedido (Caja)" → la cuenta pasa a caja.
5. **Caja** elige método de pago y tipo de comprobante:
   - **Boleta**: DNI opcional (8 dígitos).
   - **Factura**: exige RUC de 11 dígitos y razón social.

   Al cobrar se registra el pago, se emite el comprobante con correlativo
   automático (`B001-00000001`, `F001-00000001`), se libera la mesa y se abre
   el PDF del comprobante.
6. **Caja** cierra el turno al terminar: el sistema calcula
   `saldo_final = saldo_inicial + ingresos − egresos` y guarda el arqueo.

> El botón COBRAR aparece deshabilitado mientras la caja esté cerrada. Es
> intencional: todo cobro queda asociado a un turno para que el arqueo cuadre.

---

## 7. Cambiar las contraseñas

Entra como `admin` / `1234` y, en la pestaña **Personal**, usa el botón
**Contraseña** de cada trabajador para asignarle una nueva (mínimo 6
caracteres). Hazlo antes de usar el sistema de verdad.

> Para cambiar la contraseña del propio Admin existe el endpoint
> `PUT /api/auth/password` (envía `password_actual` y `password_nueva`).
> Todavía no tiene interfaz gráfica.

### Seguridad de cuentas

- Tras **5 intentos fallidos** la cuenta se **bloquea** automáticamente.
  El admin la libera con el botón **Desbloquear**, que aparece solo en las
  cuentas bloqueadas.
- El endpoint de login admite como máximo **20 intentos por IP cada 15 minutos**.
- Un trabajador marcado como **inactivo** no puede iniciar sesión.
- Todos los accesos quedan registrados en la tabla `logsesion`
  (consultables en `GET /api/admin/logs`).

---

## Desarrollo local después de la migración

El proyecto ahora usa **PostgreSQL**, no MySQL. Para trabajar en local tienes dos opciones:

**Opción A — Postgres local:** instala PostgreSQL, crea la BD y en `backend/.env`:

```env
DATABASE_URL=postgres://postgres:TU_PASSWORD@localhost:5432/lacasitadpicaron
```

Luego carga el esquema: `psql "postgres://..." -f backend/schema.postgres.sql`

**Opción B — usar la BD de Render:** pega la *External Database URL* de Render
directamente como `DATABASE_URL` en tu `.env` local.

Arrancar:

```bash
cd backend  && npm install && npm run dev     # http://localhost:3000
cd frontend && npm install && npm run dev     # http://localhost:5173
```

---

## Notas sobre el plan gratuito de Render

- **Cold start:** el backend se duerme tras ~15 min sin tráfico. La primera
  petición puede tardar ~50 segundos en responder. Es normal.
- **Base de datos:** la instancia gratuita de PostgreSQL expira a los 30 días.
  Haz respaldos si los datos importan.
- **PDFs:** se generan en disco efímero (`backend/pdf/`). Se pierden en cada
  reinicio, pero como se descargan al momento, no afecta al uso normal.
