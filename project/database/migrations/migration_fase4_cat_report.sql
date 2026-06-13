-- =========================================================
-- Migración — Reportes y apelaciones de categorías
-- =========================================================
-- Extiende las tablas reporte y apelacion para soportar categorías
-- además de contenido (tema/comentario). Usa el patrón XOR (exactamente
-- uno de contenido_id o categoria_id seteado), igual que comentario
-- usa tema_id XOR categoria_id.
--
-- Ejecutar:
--   psql -h localhost -U <usuario> -d udelarhits -f migrations/migration_fase4_cat_report.sql
-- =========================================================

BEGIN;

-- ---------------------------------------------------------
-- 1. REPORTE: agregar categoria_id + CHECK XOR
-- ---------------------------------------------------------

-- Hacer contenido_id nullable (era NOT NULL)
ALTER TABLE reporte ALTER COLUMN contenido_id DROP NOT NULL;

-- Agregar categoria_id
ALTER TABLE reporte ADD COLUMN IF NOT EXISTS categoria_id BIGINT NULL
  REFERENCES categoria(id) ON DELETE CASCADE;

-- CHECK: exactamente uno de los dos seteado
ALTER TABLE reporte ADD CONSTRAINT reporte_target_check CHECK (
  (contenido_id IS NOT NULL AND categoria_id IS NULL) OR
  (contenido_id IS NULL AND categoria_id IS NOT NULL)
);

-- Reemplazar el UNIQUE (usuario_id, contenido_id) por dos parciales
-- El nombre default del UNIQUE es reporte_usuario_id_contenido_id_key
ALTER TABLE reporte DROP CONSTRAINT IF EXISTS reporte_usuario_id_contenido_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_reporte_usuario_contenido
  ON reporte (usuario_id, contenido_id)
  WHERE contenido_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_reporte_usuario_categoria
  ON reporte (usuario_id, categoria_id)
  WHERE categoria_id IS NOT NULL;

-- Índice para contar reportes de una categoría
CREATE INDEX IF NOT EXISTS idx_reporte_categoria
  ON reporte (categoria_id)
  WHERE categoria_id IS NOT NULL;

-- ---------------------------------------------------------
-- 2. APELACION: agregar categoria_id + CHECK XOR
-- ---------------------------------------------------------

-- Hacer contenido_id nullable (era NOT NULL)
ALTER TABLE apelacion ALTER COLUMN contenido_id DROP NOT NULL;

-- Agregar categoria_id
ALTER TABLE apelacion ADD COLUMN IF NOT EXISTS categoria_id BIGINT NULL
  REFERENCES categoria(id) ON DELETE CASCADE;

-- CHECK: exactamente uno seteado
ALTER TABLE apelacion ADD CONSTRAINT apelacion_target_check CHECK (
  (contenido_id IS NOT NULL AND categoria_id IS NULL) OR
  (contenido_id IS NULL AND categoria_id IS NOT NULL)
);

-- Reemplazar el índice parcial de apelación pendiente
DROP INDEX IF EXISTS uq_apelacion_pendiente;

CREATE UNIQUE INDEX uq_apelacion_pendiente_contenido
  ON apelacion (contenido_id)
  WHERE contenido_id IS NOT NULL AND estado = 'pendiente';

CREATE UNIQUE INDEX uq_apelacion_pendiente_categoria
  ON apelacion (categoria_id)
  WHERE categoria_id IS NOT NULL AND estado = 'pendiente';

COMMIT;