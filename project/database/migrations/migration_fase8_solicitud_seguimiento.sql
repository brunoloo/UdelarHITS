-- Solicitudes de seguimiento (cuentas privadas)

BEGIN;

ALTER TABLE usuario_seguidor
  ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'aceptado';

-- CHECK del dominio (se agrega aparte para poder usar IF NOT EXISTS vía catálogo).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'usuario_seguidor_estado_check'
  ) THEN
    ALTER TABLE usuario_seguidor
      ADD CONSTRAINT usuario_seguidor_estado_check
      CHECK (estado IN ('pendiente','aceptado'));
  END IF;
END $$;

COMMIT;
