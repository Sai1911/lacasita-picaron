-- ============================================================
-- Migración 004: normalización del detalle del pedido
--
-- PROBLEMA QUE RESUELVE
-- El detalle de cada pedido vivía dentro de pedidos.items_json,
-- un TEXT con un array JSON. Eso implicaba:
--   · sin integridad referencial (se podía borrar un platillo y
--     los pedidos quedaban con un id huérfano dentro del JSON),
--   · estadísticas frágiles (había que agrupar por el NOMBRE
--     guardado en el JSON, no por el id),
--   · imposibilidad de consultar el detalle con SQL normal.
--
-- DECISIÓN DE DISEÑO
-- 'comanda' y 'pedidos' modelaban la misma entidad por duplicado.
-- Se consolida en 'pedidos' (la que el código realmente usa y la
-- que evolucionó con estados, descuento, propina y cobro) y se
-- elimina 'comanda'. El detalle pasa a detalle_comanda, que ya
-- tenía las columnas correctas -incluida 'nota'- sin usarse.
--
-- Ejecutar:  psql "$DATABASE_URL" -f migrations/004_normalizar_detalle.sql
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. detalle_comanda pasa a colgar de pedidos
--    id_comanda se retira ANTES de volcar los datos: es NOT NULL
--    y bloquearía la inserción de las filas migradas.
-- ------------------------------------------------------------
ALTER TABLE detalle_comanda
  ADD COLUMN IF NOT EXISTS id_pedido INT REFERENCES pedidos (id_pedido);

ALTER TABLE detalle_comanda
  DROP CONSTRAINT IF EXISTS detalle_comanda_id_comanda_fkey;
ALTER TABLE detalle_comanda DROP COLUMN IF EXISTS id_comanda;

-- ------------------------------------------------------------
-- 2. Volcar el contenido de items_json a filas reales
--    Se omiten los items cuyo platillo ya no existe: son
--    precisamente los huérfanos que el JSON permitía y que la
--    clave foránea impedirá de ahora en adelante.
-- ------------------------------------------------------------
INSERT INTO detalle_comanda (id_pedido, id_platillo, cantidad, precio_unitario, nota)
SELECT p.id_pedido,
       (elem->>'id_platillo')::int,
       GREATEST((elem->>'quantity')::int, 1),
       COALESCE((elem->>'price')::numeric, 0),
       NULLIF(elem->>'nota', '')
FROM pedidos p
CROSS JOIN LATERAL jsonb_array_elements(p.items_json::jsonb) AS elem
WHERE p.items_json IS NOT NULL
  AND p.items_json <> ''
  AND jsonb_typeof(p.items_json::jsonb) = 'array'
  AND EXISTS (
    SELECT 1 FROM platillo pl
    WHERE pl.id_platillo = (elem->>'id_platillo')::int
  );

-- ------------------------------------------------------------
-- 3. Ya con los datos dentro, el vínculo pasa a ser obligatorio
-- ------------------------------------------------------------
ALTER TABLE detalle_comanda ALTER COLUMN id_pedido SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_detalle_pedido ON detalle_comanda (id_pedido);
CREATE INDEX IF NOT EXISTS idx_detalle_platillo ON detalle_comanda (id_platillo);

-- ------------------------------------------------------------
-- 4. Normalizar el cliente
--    Los datos iban sueltos en pedidos (nombre_cliente, doc_cliente).
--    Ahora se guardan una sola vez en 'cliente' y el pedido apunta.
-- ------------------------------------------------------------
ALTER TABLE cliente
  ADD CONSTRAINT uq_cliente_documento UNIQUE (dni_ruc);

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS id_cliente INT REFERENCES cliente (id_cliente);

INSERT INTO cliente (nombre, dni_ruc)
SELECT DISTINCT ON (doc_cliente)
       COALESCE(NULLIF(nombre_cliente, ''), 'Cliente'),
       doc_cliente
FROM pedidos
WHERE doc_cliente IS NOT NULL AND doc_cliente <> ''
ON CONFLICT (dni_ruc) DO NOTHING;

UPDATE pedidos p
SET id_cliente = c.id_cliente
FROM cliente c
WHERE c.dni_ruc = p.doc_cliente
  AND p.doc_cliente IS NOT NULL
  AND p.doc_cliente <> '';

-- ------------------------------------------------------------
-- 5. Retirar lo que quedó obsoleto
--    'comanda' era el duplicado de 'pedidos' y nunca se usó.
-- ------------------------------------------------------------
DROP TABLE IF EXISTS comanda CASCADE;

ALTER TABLE pedidos DROP COLUMN IF EXISTS items_json;

COMMIT;
