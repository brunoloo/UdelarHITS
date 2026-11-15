-- Facultad del usuario en el perfil

BEGIN;

ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS facultad VARCHAR(20) NULL;

ALTER TABLE verificacion_registro
  ADD COLUMN IF NOT EXISTS facultad VARCHAR(20) NULL;

COMMIT;
