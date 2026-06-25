-- =========================================================
-- Migración Fase 12 — Contenido guardado (categorías/temas/comentarios)
-- =========================================================
-- Idempotente. Para la base de DESARROLLO (udelarhits).
-- Reflejado también en schema.sql (la base de test se recrea desde ahí).
--
-- Ejecutar:
--   psql -h localhost -U <usuario> -d udelarhits -f migrations/migration_fase12_guardados.sql
-- =========================================================

BEGIN;

CREATE TABLE IF NOT EXISTS guardado (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('categoria','tema','comentario')),
  categoria_id BIGINT REFERENCES categoria(id) ON DELETE CASCADE,
  contenido_id BIGINT REFERENCES contenido(id) ON DELETE CASCADE,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((categoria_id IS NOT NULL)::int + (contenido_id IS NOT NULL)::int = 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_guardado_categoria ON guardado(usuario_id, categoria_id) WHERE categoria_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_guardado_contenido ON guardado(usuario_id, contenido_id) WHERE contenido_id IS NOT NULL;

COMMIT;
