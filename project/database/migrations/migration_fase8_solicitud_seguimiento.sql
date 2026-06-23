-- =========================================================
-- Migración Fase 8 — Solicitudes de seguimiento (cuentas privadas)
-- =========================================================
-- Idempotente. Para la base de DESARROLLO (udelarhits).
-- Reflejado también en schema.sql (la base de test se recrea desde ahí).
--
-- Ejecutar:
--   psql -h localhost -U <usuario> -d udelarhits -f migrations/migration_fase8_solicitud_seguimiento.sql
-- =========================================================

BEGIN;

-- estado del seguimiento: 'aceptado' = sigue efectivamente; 'pendiente' =
-- solicitud a una cuenta privada esperando que el receptor acepte/rechace.
-- Las filas existentes quedan como 'aceptado' (DEFAULT), preservando seguidores.
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
