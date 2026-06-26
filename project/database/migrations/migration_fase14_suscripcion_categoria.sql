-- =========================================================
-- Migración Fase 14 — Suscripción a categoría (campanita)
-- =========================================================
-- Idempotente. Para la base de DESARROLLO (udelarhits).
-- Reflejado también en schema.sql (la base de test se recrea desde ahí).
--
-- Ejecutar:
--   psql -h localhost -U <usuario> -d udelarhits -f migrations/migration_fase14_suscripcion_categoria.sql
-- =========================================================

BEGIN;

CREATE TABLE IF NOT EXISTS suscripcion_categoria (
  usuario_id     BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  categoria_id   BIGINT NOT NULL REFERENCES categoria(id) ON DELETE CASCADE,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, categoria_id)
);

COMMIT;
