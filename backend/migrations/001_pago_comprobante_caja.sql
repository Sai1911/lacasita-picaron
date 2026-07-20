-- ============================================================
-- Migración 001: cierre del ciclo de cobro
--   · Vincula el pago con el pedido      (pedidos.id_pago)
--   · Vincula el pago con el turno de caja (pago.id_caja)
--   · Apertura de caja                   (caja.fecha_apertura)
--   · Correlativo único de comprobantes
--
-- Solo es necesaria si YA creaste las tablas con una versión
-- anterior de schema.postgres.sql. Si partes de cero, el schema
-- actualizado ya incluye todo esto.
--
-- Ejecutar:  psql "$DATABASE_URL" -f migrations/001_pago_comprobante_caja.sql
-- ============================================================

BEGIN;

-- 1. Momento de apertura del turno de caja
ALTER TABLE caja
  ADD COLUMN IF NOT EXISTS fecha_apertura TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- 2. Estado de caja acotado a valores válidos
ALTER TABLE caja DROP CONSTRAINT IF EXISTS caja_estado_check;
ALTER TABLE caja
  ADD CONSTRAINT caja_estado_check CHECK (estado IN ('Abierta', 'Cerrada'));

-- 3. El pago pertenece a un turno de caja (base del arqueo)
ALTER TABLE pago
  ADD COLUMN IF NOT EXISTS id_caja INT REFERENCES caja (id_caja);

-- 4. El pedido queda vinculado a su cobro
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS id_pago INT REFERENCES pago (id_pago);

-- 5. Tipo de comprobante acotado y correlativo único por serie
ALTER TABLE comprobante_pago
  DROP CONSTRAINT IF EXISTS comprobante_pago_tipo_comprobante_check;
ALTER TABLE comprobante_pago
  ADD CONSTRAINT comprobante_pago_tipo_comprobante_check
  CHECK (tipo_comprobante IN ('boleta', 'factura'));

ALTER TABLE comprobante_pago
  DROP CONSTRAINT IF EXISTS uq_comprobante_serie;
ALTER TABLE comprobante_pago
  ADD CONSTRAINT uq_comprobante_serie
  UNIQUE (tipo_comprobante, numero_comprobante);

COMMIT;
