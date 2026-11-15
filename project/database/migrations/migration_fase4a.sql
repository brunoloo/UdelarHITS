-- Moderación: reportes + umbral + inactivación

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'motivo_inactivacion') THEN
    CREATE TYPE motivo_inactivacion AS ENUM ('autor', 'moderacion_reporte', 'moderacion_admin');
  END IF;
END$$;

-- Columnas en TEMA
ALTER TABLE tema ADD COLUMN IF NOT EXISTS motivo_inactivacion motivo_inactivacion NULL;
ALTER TABLE tema ADD COLUMN IF NOT EXISTS fecha_inactivacion  TIMESTAMPTZ NULL;

-- Columnas en COMENTARIO
ALTER TABLE comentario ADD COLUMN IF NOT EXISTS motivo_inactivacion motivo_inactivacion NULL;
ALTER TABLE comentario ADD COLUMN IF NOT EXISTS fecha_inactivacion  TIMESTAMPTZ NULL;
ALTER TABLE comentario ADD COLUMN IF NOT EXISTS inactivado_directo BOOLEAN NOT NULL DEFAULT FALSE;

-- Columnas en CATEGORIA (previsto para reporte de categorías, futuro)
ALTER TABLE categoria ADD COLUMN IF NOT EXISTS motivo_inactivacion motivo_inactivacion NULL;
ALTER TABLE categoria ADD COLUMN IF NOT EXISTS fecha_inactivacion  TIMESTAMPTZ NULL;

ALTER TABLE tema ADD COLUMN IF NOT EXISTS inactivado_directo BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE tema
  SET motivo_inactivacion = 'autor'
  WHERE estado = 'inactivo' AND motivo_inactivacion IS NULL;

UPDATE comentario
  SET motivo_inactivacion = 'autor'
  WHERE estado = 'oculto' AND motivo_inactivacion IS NULL;

UPDATE categoria
  SET motivo_inactivacion = 'autor'
  WHERE estado = 'inactiva' AND motivo_inactivacion IS NULL;

CREATE INDEX IF NOT EXISTS idx_tema_moderacion
  ON tema (motivo_inactivacion)
  WHERE motivo_inactivacion = 'moderacion_reporte';

CREATE INDEX IF NOT EXISTS idx_comentario_moderacion
  ON comentario (motivo_inactivacion)
  WHERE motivo_inactivacion = 'moderacion_reporte';

COMMIT;
