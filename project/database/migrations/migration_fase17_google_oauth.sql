-- =========================================================
-- Migración Fase 17 — Login con Google (OAuth 2.0)
-- =========================================================
-- Idempotente. Para la base de DESARROLLO (udelarhits).
-- Reflejado también en schema.sql (la base de test se recrea desde ahí).
--
-- Ejecutar:
--   npm run db:migrate:fase17
-- =========================================================

BEGIN;

-- auth_provider: método de autenticación de la cuenta ('local' o 'google').
-- Las filas existentes quedan con 'local' (DEFAULT), que es lo correcto para
-- las cuentas creadas antes de esta migración.
ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(10) NOT NULL DEFAULT 'local';

-- Las cuentas de Google no tienen contraseña propia (password_hash = NULL).
ALTER TABLE usuario
  ALTER COLUMN password_hash DROP NOT NULL;

COMMIT;
