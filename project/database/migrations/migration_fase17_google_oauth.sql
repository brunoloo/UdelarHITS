-- Login con Google (OAuth 2.0)

BEGIN;

ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(10) NOT NULL DEFAULT 'local';

-- Las cuentas de Google no tienen contraseña propia (password_hash = NULL).
ALTER TABLE usuario
  ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS nickname_confirmado BOOLEAN NOT NULL DEFAULT TRUE;

COMMIT;
