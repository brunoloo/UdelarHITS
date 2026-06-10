-- =========================================================
-- Migración Fase 4.A — Moderación: reportes + umbral + inactivación
-- =========================================================
-- Idempotente y no destructiva. Pensada para correr sobre la base de
-- DESARROLLO (udelarhits) que NO se recrea sola. La base de test se
-- recrea desde schema.sql, así que estos mismos cambios deben quedar
-- reflejados también en schema.sql (ver schema_patch_fase4a.sql).
--
-- Ejecutar:
--   psql -h localhost -U <usuario> -d udelarhits -f migration_fase4a.sql
-- =========================================================

BEGIN;

-- ---------------------------------------------------------
-- 1. Enum del motivo de inactivación
-- ---------------------------------------------------------
-- Distingue POR QUÉ un contenido quedó inactivo/oculto. Nunca se infiere
-- por ausencia de dato: cada inactivación escribe su motivo explícito.
--   'autor'             → lo borró su propio autor (Fase 2)
--   'moderacion_reporte'→ cayó por cruzar el umbral de reportes (Fase 4.A)
--   'moderacion_admin'  → lo eliminó un admin como acción de moderación (Fase 4.C, previsto)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'motivo_inactivacion') THEN
    CREATE TYPE motivo_inactivacion AS ENUM ('autor', 'moderacion_reporte', 'moderacion_admin');
  END IF;
END$$;

-- ---------------------------------------------------------
-- 2. Columnas en TEMA
-- ---------------------------------------------------------
ALTER TABLE tema ADD COLUMN IF NOT EXISTS motivo_inactivacion motivo_inactivacion NULL;
ALTER TABLE tema ADD COLUMN IF NOT EXISTS fecha_inactivacion  TIMESTAMPTZ NULL;

-- ---------------------------------------------------------
-- 3. Columnas en COMENTARIO
-- ---------------------------------------------------------
ALTER TABLE comentario ADD COLUMN IF NOT EXISTS motivo_inactivacion motivo_inactivacion NULL;
ALTER TABLE comentario ADD COLUMN IF NOT EXISTS fecha_inactivacion  TIMESTAMPTZ NULL;
-- inactivado_directo: TRUE si este contenido cruzó su PROPIO umbral de reportes.
-- FALSE/ausente si cayó "por arrastre" (su tema padre fue reportado y lo ocultó).
-- Lo usa la Fase 4.B para decidir qué es apelable: solo lo inactivado_directo se apela.
ALTER TABLE comentario ADD COLUMN IF NOT EXISTS inactivado_directo BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------
-- 4. Columnas en CATEGORIA (previsto para reporte de categorías, futuro)
-- ---------------------------------------------------------
ALTER TABLE categoria ADD COLUMN IF NOT EXISTS motivo_inactivacion motivo_inactivacion NULL;
ALTER TABLE categoria ADD COLUMN IF NOT EXISTS fecha_inactivacion  TIMESTAMPTZ NULL;

-- ---------------------------------------------------------
-- 5. Tema: marcar inactivado_directo también (simetría con comentario)
-- ---------------------------------------------------------
-- Un tema reportado siempre es inactivación directa (no hay "arrastre" hacia temas).
-- Igual dejamos la columna por consistencia y para que la 4.B lea lo mismo en ambos.
ALTER TABLE tema ADD COLUMN IF NOT EXISTS inactivado_directo BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------
-- 6. Backfill de datos preexistentes
-- ---------------------------------------------------------
-- Antes de Fase 4 lo único que inactivaba contenido era el borrado por autor.
-- Marcamos esas filas existentes como 'autor' para que el motivo nunca quede
-- ambiguo. Solo toca filas ya inactivas/ocultas sin motivo.
UPDATE tema
  SET motivo_inactivacion = 'autor'
  WHERE estado = 'inactivo' AND motivo_inactivacion IS NULL;

UPDATE comentario
  SET motivo_inactivacion = 'autor'
  WHERE estado = 'oculto' AND motivo_inactivacion IS NULL;

UPDATE categoria
  SET motivo_inactivacion = 'autor'
  WHERE estado = 'inactiva' AND motivo_inactivacion IS NULL;

-- ---------------------------------------------------------
-- 7. Índices de apoyo para el conteo de reportes
-- ---------------------------------------------------------
-- idx_reporte_contenido ya existe en schema v1. Agregamos uno parcial útil
-- para listar/contar contenido caído por moderación en paneles (4.B/4.C).
CREATE INDEX IF NOT EXISTS idx_tema_moderacion
  ON tema (motivo_inactivacion)
  WHERE motivo_inactivacion = 'moderacion_reporte';

CREATE INDEX IF NOT EXISTS idx_comentario_moderacion
  ON comentario (motivo_inactivacion)
  WHERE motivo_inactivacion = 'moderacion_reporte';

COMMIT;

-- =========================================================
-- NOTA Fase 4.B (NO ejecutar todavía, queda documentado acá):
-- Para impedir apelaciones duplicadas sobre el mismo contenido mientras
-- una está pendiente, agregar un índice único parcial:
--
--   CREATE UNIQUE INDEX uq_apelacion_pendiente
--     ON apelacion (contenido_id)
--     WHERE estado = 'pendiente';
--
-- Y la validación "solo el autor del contenido puede apelar" vive en el
-- service, no en el schema.
-- =========================================================
