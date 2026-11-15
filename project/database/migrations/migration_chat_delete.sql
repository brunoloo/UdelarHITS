-- Borrado de chat por usuario

BEGIN;

ALTER TABLE conversacion
  ADD COLUMN IF NOT EXISTS borrado_por_usuario1_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS borrado_por_usuario2_at TIMESTAMPTZ;

COMMIT;
