-- ============================================================
-- Migración 002: anulación de pedidos y comprobantes
--   · pedidos puede quedar en estado 'anulado' (con motivo y autor)
--   · pago puede anularse sin borrarse (queda fuera del arqueo)
--   · comprobante_pago puede anularse conservando su correlativo
--
-- Ejecutar:  psql "$DATABASE_URL" -f migrations/002_anulaciones.sql
-- ============================================================

BEGIN;

-- 1. Nuevo estado 'anulado' para los pedidos
ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_estado_check;
ALTER TABLE pedidos
  ADD CONSTRAINT pedidos_estado_check
  CHECK (estado IN ('pendiente', 'listo', 'servido', 'por_pagar', 'pagado', 'anulado'));

-- 2. Trazabilidad de la anulación del pedido
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS motivo_anulacion VARCHAR(255);
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS anulado_por INT REFERENCES personal (id_personal);

-- 3. Un pago anulado se conserva, pero se excluye del arqueo
ALTER TABLE pago
  ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'activo';
ALTER TABLE pago
  ADD COLUMN IF NOT EXISTS motivo_anulacion VARCHAR(255);
ALTER TABLE pago
  ADD COLUMN IF NOT EXISTS fecha_anulacion TIMESTAMP;

ALTER TABLE pago DROP CONSTRAINT IF EXISTS pago_estado_check;
ALTER TABLE pago
  ADD CONSTRAINT pago_estado_check CHECK (estado IN ('activo', 'anulado'));

-- 4. El comprobante anulado conserva su número (no se reutiliza)
ALTER TABLE comprobante_pago
  ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'emitido';

ALTER TABLE comprobante_pago DROP CONSTRAINT IF EXISTS comprobante_pago_estado_check;
ALTER TABLE comprobante_pago
  ADD CONSTRAINT comprobante_pago_estado_check CHECK (estado IN ('emitido', 'anulado'));

COMMIT;
