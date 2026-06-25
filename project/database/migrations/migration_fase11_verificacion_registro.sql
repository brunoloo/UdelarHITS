-- =========================================================
-- Migración Fase 11 — Verificación de email en el registro
-- =========================================================
-- Idempotente. Para la base de DESARROLLO (udelarhits).
-- Reflejado también en schema.sql (la base de test se recrea desde ahí).
--
-- Ejecutar:
--   psql -h localhost -U <usuario> -d udelarhits -f migrations/migration_fase11_verificacion_registro.sql
-- =========================================================

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
