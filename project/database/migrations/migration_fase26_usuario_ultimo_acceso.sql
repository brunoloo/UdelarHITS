-- Fecha del último acceso de cada usuario (panel de administración)

BEGIN;

ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS fecha_ultimo_acceso TIMESTAMPTZ NULL;

COMMIT;
