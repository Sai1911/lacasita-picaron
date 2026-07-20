-- ============================================================
-- Migración 003: operativa real del restaurante
--   · Descuento y propina por pedido
--   · Asignación de mozo a mesa (revive mesa.id_personal_asignado)
--
-- Las notas por platillo y el estado 'servido' no necesitan cambios
-- de esquema: la nota viaja dentro de items_json y 'servido' ya
-- estaba contemplado en el CHECK de pedidos.estado.
--
-- Ejecutar:  psql "$DATABASE_URL" -f migrations/003_operacion_restaurante.sql
-- ============================================================

BEGIN;

-- 1. Descuento y propina (se aplican al cobrar, en caja)
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS descuento NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS propina NUMERIC(10,2) NOT NULL DEFAULT 0;

ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_descuento_check;
ALTER TABLE pedidos
  ADD CONSTRAINT pedidos_descuento_check CHECK (descuento >= 0);

ALTER TABLE pedidos DROP CONSTRAINT IF EXISTS pedidos_propina_check;
ALTER TABLE pedidos
  ADD CONSTRAINT pedidos_propina_check CHECK (propina >= 0);

-- 2. Momento en que el mozo entregó el pedido en la mesa
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS fecha_servido TIMESTAMP;

-- 3. Índices para las consultas más frecuentes
--    (pedidos abiertos por mesa, y cola de cocina)
CREATE INDEX IF NOT EXISTS idx_pedidos_mesa_estado ON pedidos (id_mesa, estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado_fecha ON pedidos (estado, fecha_creacion);
CREATE INDEX IF NOT EXISTS idx_pago_caja_estado ON pago (id_caja, estado);

COMMIT;
