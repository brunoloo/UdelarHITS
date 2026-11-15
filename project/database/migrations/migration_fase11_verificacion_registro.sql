-- Verificación de email en el registro

BEGIN;

CREATE TABLE IF NOT EXISTS verificacion_registro (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  codigo VARCHAR(6) NOT NULL,
  nickname VARCHAR(50) NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  password_hash TEXT NOT NULL,
  intentos INT NOT NULL DEFAULT 0,
  usado BOOLEAN NOT NULL DEFAULT FALSE,
  expira_en TIMESTAMPTZ NOT NULL,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_verificacion_registro_email ON verificacion_registro(email);

COMMIT;
