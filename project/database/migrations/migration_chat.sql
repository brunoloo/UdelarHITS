-- =========================================================
-- Migración Chat 1:1
-- =========================================================
-- Idempotente. Tablas para el chat de mensajes directos.
--
-- Ejecutar:
--   psql -h localhost -U <usuario> -d udelarhits -f migrations/migration_chat.sql
-- =========================================================

BEGIN;

CREATE TABLE IF NOT EXISTS conversacion (
  id                BIGSERIAL PRIMARY KEY,
  usuario1_id       BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  usuario2_id       BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  ultimo_mensaje_at TIMESTAMPTZ,
  fecha_creacion    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (usuario1_id < usuario2_id),
  UNIQUE (usuario1_id, usuario2_id)
);

CREATE TABLE IF NOT EXISTS mensaje (
  id                BIGSERIAL PRIMARY KEY,
  conversacion_id   BIGINT NOT NULL REFERENCES conversacion(id) ON DELETE CASCADE,
  autor_id          BIGINT NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  cuerpo            TEXT NOT NULL,
  leido             BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_creacion    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mensaje_conversacion ON mensaje(conversacion_id, fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_mensaje_autor ON mensaje(autor_id);
CREATE INDEX IF NOT EXISTS idx_conversacion_usuario1 ON conversacion(usuario1_id);
CREATE INDEX IF NOT EXISTS idx_conversacion_usuario2 ON conversacion(usuario2_id);

COMMIT;
