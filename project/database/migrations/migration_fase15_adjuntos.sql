-- =========================================================
-- Migración Fase 15 — Adjuntos en comentarios
-- =========================================================
-- Idempotente. Para la base de DESARROLLO (udelarhits).
-- Reflejado también en schema.sql (la base de test se recrea desde ahí).
--
-- Ejecutar:
--   psql -h localhost -U <usuario> -d udelarhits -f migrations/migration_fase15_adjuntos.sql
-- =========================================================

BEGIN;

CREATE TABLE IF NOT EXISTS adjunto (
  id              BIGSERIAL PRIMARY KEY,
  contenido_id    BIGINT NOT NULL REFERENCES contenido(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  public_id       TEXT NOT NULL,
  nombre_original VARCHAR(255) NOT NULL,
  tipo            VARCHAR(20) NOT NULL,
  tamano          INTEGER NOT NULL,
  fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_adjunto_contenido ON adjunto(contenido_id);

COMMIT;
