-- Adjuntos en comentarios

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
