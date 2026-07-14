-- =========================================================
-- Migración Fase 18 — Moderación automática de imágenes (Cloud Vision SafeSearch)
-- =========================================================
-- Idempotente. Para la base de DESARROLLO (udelarhits).
-- Reflejado también en schema.sql (la base de test se recrea desde ahí).
--
-- Ejecutar:
--   npm run db:migrate:fase18
-- =========================================================

BEGIN;

-- ---------------------------------------------------------
-- 1. Estado de moderación en adjunto
-- ---------------------------------------------------------
-- DEFAULT 'publicado' garantiza retrocompatibilidad: todas las filas
-- existentes (y los documentos, que no pasan por Vision) quedan publicadas.
ALTER TABLE adjunto
  ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'publicado';

-- El CHECK se agrega aparte para poder usar IF NOT EXISTS de forma segura.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'adjunto_estado_check'
  ) THEN
    ALTER TABLE adjunto
      ADD CONSTRAINT adjunto_estado_check
      CHECK (estado IN ('publicado', 'pendiente_revision', 'rechazado'));
  END IF;
END $$;

-- Scores de Vision (solo referencia para el admin; NULL si no aplica).
ALTER TABLE adjunto
  ADD COLUMN IF NOT EXISTS score_adult VARCHAR(20),
  ADD COLUMN IF NOT EXISTS score_racy  VARCHAR(20);

-- Índice parcial para la cola de revisión del admin.
CREATE INDEX IF NOT EXISTS idx_adjunto_pendiente
  ON adjunto(estado, fecha_creacion)
  WHERE estado = 'pendiente_revision';

-- ---------------------------------------------------------
-- 2. Tabla de imágenes de avatar/banner retenidas
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS imagen_pendiente (
  id              BIGSERIAL PRIMARY KEY,
  usuario_id      BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  public_id       TEXT NOT NULL,
  tipo            VARCHAR(10) NOT NULL CHECK (tipo IN ('avatar', 'banner')),
  score_adult     VARCHAR(20),
  score_racy      VARCHAR(20),
  fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_imagen_pendiente_fecha
  ON imagen_pendiente(fecha_creacion);

COMMIT;
