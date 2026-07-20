-- ============================================================
-- Esquema PostgreSQL para "La Casita del Picarón"
-- Migrado desde MySQL (schema.sql).
-- Ejecutar una vez sobre la base de datos de Render:
--   psql "$DATABASE_URL" -f schema.postgres.sql
-- ============================================================

-- -----------------------------------------------------
-- Tabla: caja
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS caja (
  id_caja        SERIAL PRIMARY KEY,
  nombre_caja    VARCHAR(20) NOT NULL,
  turno          VARCHAR(20),
  estado         VARCHAR(20) DEFAULT 'Cerrada'
                   CHECK (estado IN ('Abierta', 'Cerrada')),
  saldo_inicial  NUMERIC(10,2) NOT NULL,
  -- Momento de apertura del turno: delimita qué pagos entran en el arqueo.
  fecha_apertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -----------------------------------------------------
-- Tabla: cliente
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS cliente (
  id_cliente SERIAL PRIMARY KEY,
  nombre     VARCHAR(100) NOT NULL,
  -- Documento único: un cliente recurrente se registra una sola vez
  dni_ruc    VARCHAR(11) UNIQUE,
  telefono   VARCHAR(15),
  correo     VARCHAR(100)
);

-- -----------------------------------------------------
-- Tabla: personal
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS personal (
  id_personal       SERIAL PRIMARY KEY,
  nombre            VARCHAR(50) NOT NULL,
  apellido          VARCHAR(50) NOT NULL,
  dni               VARCHAR(8) NOT NULL UNIQUE,
  codigo_acceso     VARCHAR(20) NOT NULL UNIQUE,
  password_hash     VARCHAR(255) NOT NULL,
  intentos_fallidos INT DEFAULT 0,
  cargo             VARCHAR(20) NOT NULL CHECK (cargo IN ('Mozo', 'Cocina', 'Caja', 'Admin')),
  salario           NUMERIC(10,2) DEFAULT 0.00,
  estado            VARCHAR(20) DEFAULT 'activo'
);

-- -----------------------------------------------------
-- Tabla: mesa
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS mesa (
  id_mesa               SERIAL PRIMARY KEY,
  numero_mesa           VARCHAR(10) NOT NULL UNIQUE,
  estado                VARCHAR(20) DEFAULT 'Disponible'
                          CHECK (estado IN ('Disponible', 'Ocupada', 'Por pagar')),
  id_personal_asignado  INT REFERENCES personal (id_personal)
);

-- -----------------------------------------------------
-- Tabla: pago
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS pago (
  id_pago     SERIAL PRIMARY KEY,
  monto_total NUMERIC(10,2) NOT NULL,
  metodo_pago VARCHAR(20) NOT NULL,
  fecha_pago  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- Caja (turno) en la que se registró el cobro. Base del arqueo.
  id_caja     INT REFERENCES caja (id_caja),
  -- Un cobro anulado NO se borra: deja rastro y se excluye del arqueo.
  estado           VARCHAR(20) NOT NULL DEFAULT 'activo'
                     CHECK (estado IN ('activo', 'anulado')),
  motivo_anulacion VARCHAR(255),
  fecha_anulacion  TIMESTAMP
);

-- NOTA DE DISEÑO
-- La tabla 'comanda' se retiró: modelaba la misma entidad que
-- 'pedidos' por duplicado. Se consolidó en 'pedidos', que es la que
-- el sistema usa y la que reúne el flujo de estados, el descuento,
-- la propina y el cobro. El detalle vive en 'detalle_comanda'.

-- -----------------------------------------------------
-- Tabla: comprobante_pago
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS comprobante_pago (
  id_comprobante     SERIAL PRIMARY KEY,
  tipo_comprobante   VARCHAR(20) NOT NULL
                       CHECK (tipo_comprobante IN ('boleta', 'factura')),
  numero_comprobante VARCHAR(20) NOT NULL,
  fecha_emision      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  id_pago            INT NOT NULL REFERENCES pago (id_pago),
  -- Un comprobante anulado conserva su número: los correlativos
  -- no se reutilizan nunca.
  estado             VARCHAR(20) NOT NULL DEFAULT 'emitido'
                       CHECK (estado IN ('emitido', 'anulado')),
  -- El correlativo no puede repetirse dentro de una misma serie.
  CONSTRAINT uq_comprobante_serie UNIQUE (tipo_comprobante, numero_comprobante)
);

-- -----------------------------------------------------
-- Tabla: platillo
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS platillo (
  id_platillo    SERIAL PRIMARY KEY,
  nombre         VARCHAR(100) NOT NULL,
  descripcion    VARCHAR(255),
  categoria      VARCHAR(20) NOT NULL
                   CHECK (categoria IN ('Calientes', 'Frias', 'Parrilla', 'Entradas', 'Postres', 'Bebidas')),
  precio         NUMERIC(10,2) NOT NULL,
  disponibilidad SMALLINT DEFAULT 1
);

-- -----------------------------------------------------
-- Tabla: logsesion
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS logsesion (
  id_log            SERIAL PRIMARY KEY,
  id_personal       INT NOT NULL REFERENCES personal (id_personal),
  fecha_hora_inicio TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_hora_cierre TIMESTAMP,
  tipo_evento       VARCHAR(20)
);

-- -----------------------------------------------------
-- Tabla: pedidos  (núcleo del flujo mozo → cocina → caja)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS pedidos (
  id_pedido      SERIAL PRIMARY KEY,
  id_mesa        INT REFERENCES mesa (id_mesa),
  id_personal    INT REFERENCES personal (id_personal),
  total          NUMERIC(10,2) DEFAULT 0,
  estado         VARCHAR(20) DEFAULT 'pendiente'
                   CHECK (estado IN ('pendiente', 'listo', 'servido', 'por_pagar', 'pagado', 'anulado')),
  -- Datos del cliente: normalizados en 'cliente', copiados aquí al
  -- cobrar para conservar el dato tal cual salió en el comprobante.
  id_cliente     INT REFERENCES cliente (id_cliente),
  nombre_cliente VARCHAR(100),
  doc_cliente    VARCHAR(20),
  tipo_doc       VARCHAR(20) CHECK (tipo_doc IN ('boleta', 'factura')),
  fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Vincula el pedido con su cobro (antes no existía relación alguna).
  id_pago        INT REFERENCES pago (id_pago),
  -- Trazabilidad de la anulación
  motivo_anulacion VARCHAR(255),
  anulado_por      INT REFERENCES personal (id_personal),
  -- Ajustes aplicados al cobrar (en caja)
  descuento      NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (descuento >= 0),
  propina        NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (propina >= 0),
  -- Momento en que el mozo entregó los platos en la mesa
  fecha_servido  TIMESTAMP
);

-- Índices para las consultas más frecuentes
CREATE INDEX IF NOT EXISTS idx_pedidos_mesa_estado ON pedidos (id_mesa, estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado_fecha ON pedidos (estado, fecha_creacion);
CREATE INDEX IF NOT EXISTS idx_pago_caja_estado ON pago (id_caja, estado);

-- -----------------------------------------------------
-- Tabla: detalle_comanda  (una fila por línea del pedido)
-- -----------------------------------------------------
-- Sustituye al antiguo pedidos.items_json (un TEXT con JSON), que no
-- permitía integridad referencial ni consultas SQL sobre lo vendido.
CREATE TABLE IF NOT EXISTS detalle_comanda (
  id_detalle      SERIAL PRIMARY KEY,
  id_pedido       INT NOT NULL REFERENCES pedidos (id_pedido),
  id_platillo     INT NOT NULL REFERENCES platillo (id_platillo),
  cantidad        INT NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(10,2) NOT NULL,
  -- Indicación para cocina: "sin cebolla", "término medio"...
  nota            VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_detalle_pedido ON detalle_comanda (id_pedido);
CREATE INDEX IF NOT EXISTS idx_detalle_platillo ON detalle_comanda (id_platillo);

-- -----------------------------------------------------
-- Tabla: reportecierre
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS reportecierre (
  id_reporte     SERIAL PRIMARY KEY,
  id_personal    INT NOT NULL REFERENCES personal (id_personal),
  id_caja        INT NOT NULL REFERENCES caja (id_caja),
  fecha_cierre   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_ingresos NUMERIC(10,2) NOT NULL,
  total_egresos  NUMERIC(10,2) NOT NULL,
  saldo_final    NUMERIC(10,2) NOT NULL,
  observacion    VARCHAR(255)
);
