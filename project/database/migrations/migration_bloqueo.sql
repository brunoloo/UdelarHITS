-- =========================================================
-- Migración: sistema de bloqueo de usuarios
-- =========================================================
-- Ejecutar:
--   psql -h localhost -p 5432 -U brunoloo -d udelarhits -f migrations/migration_bloqueo.sql
-- =========================================================

BEGIN;

CREATE TABLE IF NOT EXISTS bloqueo (
  bloqueador_id  BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  bloqueado_id   BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bloqueador_id, bloqueado_id),
  CHECK (bloqueador_id <> bloqueado_id)
);

CREATE INDEX IF NOT EXISTS idx_bloqueo_bloqueado ON bloqueo(bloqueado_id);

COMMIT;
