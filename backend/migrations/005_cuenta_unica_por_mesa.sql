-- ============================================================
-- Migración 005: una sola cuenta por mesa
--
-- PROBLEMA QUE RESUELVE
-- Cuando el mozo añadía platillos y el pedido anterior ya había
-- salido de cocina (estado 'listo'/'servido') o ya se había enviado
-- a caja ('por_pagar'), el sistema creaba un PEDIDO NUEVO. Como
-- consecuencia:
--   · el mozo no veía la cuenta completa de la mesa,
--   · caja mostraba dos tarjetas para la misma mesa,
--   · y se emitían DOS comprobantes por un mismo consumo.
--
-- SOLUCIÓN
-- Todos los platillos de una mesa se acumulan en un único pedido
-- hasta que se cobra. Para que cocina no reciba de nuevo lo ya
-- preparado, cada LÍNEA del detalle lleva su propio estado.
--
-- Ejecutar:  psql "$DATABASE_URL" -f migrations/005_cuenta_unica_por_mesa.sql
-- ============================================================

BEGIN;

-- 1. Estado por línea de detalle
ALTER TABLE detalle_comanda
  ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'pendiente';

ALTER TABLE detalle_comanda DROP CONSTRAINT IF EXISTS detalle_comanda_estado_check;
ALTER TABLE detalle_comanda
  ADD CONSTRAINT detalle_comanda_estado_check
  CHECK (estado IN ('pendiente', 'listo'));

-- 2. Momento en que cocina marcó la línea como lista
ALTER TABLE detalle_comanda
  ADD COLUMN IF NOT EXISTS fecha_listo TIMESTAMP;

-- 3. Las líneas de pedidos que ya salieron de cocina se marcan como listas,
--    para no reenviarlas a preparación.
UPDATE detalle_comanda d
SET estado = 'listo', fecha_listo = COALESCE(d.fecha_listo, NOW())
FROM pedidos p
WHERE p.id_pedido = d.id_pedido
  AND p.estado IN ('listo', 'servido', 'por_pagar', 'pagado');

-- 4. Índice para la cola de cocina (líneas pendientes)
CREATE INDEX IF NOT EXISTS idx_detalle_estado ON detalle_comanda (estado);

COMMIT;
