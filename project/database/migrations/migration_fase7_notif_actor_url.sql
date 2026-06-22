-- =========================================================
-- Migración Fase 7 — Notificaciones de like / respuesta / follow
-- =========================================================
-- Idempotente. Para la base de DESARROLLO (udelarhits).
-- Reflejado también en schema.sql (la base de test se recrea desde ahí).
--
-- Ejecutar:
--   psql -h localhost -U <usuario> -d udelarhits -f migrations/migration_fase7_notif_actor_url.sql
-- =========================================================

BEGIN;

-- actor_id: usuario que generó el evento (quién dio like, respondió, siguió).
-- NULL para notificaciones de sistema/moderación. ON DELETE SET NULL para que
-- la notificación sobreviva al borrado del actor.
ALTER TABLE notificacion
  ADD COLUMN IF NOT EXISTS actor_id BIGINT NULL REFERENCES usuario(id) ON DELETE SET NULL;

-- url: destino al que navega la notificación al clickearla (ej: /topic/5).
ALTER TABLE notificacion
  ADD COLUMN IF NOT EXISTS url VARCHAR(500) NULL;

COMMIT;
