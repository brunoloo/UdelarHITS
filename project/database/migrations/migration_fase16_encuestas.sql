-- Fase 16: encuestas en comentarios.
-- Un comentario tiene a lo sumo una encuesta, con 2..5 opciones y un voto por
-- usuario. Idempotente.

CREATE TABLE IF NOT EXISTS encuesta (
  id             BIGSERIAL PRIMARY KEY,
  contenido_id   BIGINT NOT NULL REFERENCES contenido(id) ON DELETE CASCADE,
  fecha_cierre   TIMESTAMPTZ NOT NULL,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_encuesta_contenido ON encuesta(contenido_id);

CREATE TABLE IF NOT EXISTS encuesta_opcion (
  id          BIGSERIAL PRIMARY KEY,
  encuesta_id BIGINT NOT NULL REFERENCES encuesta(id) ON DELETE CASCADE,
  texto       VARCHAR(80) NOT NULL,
  orden       SMALLINT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_encuesta_opcion_encuesta ON encuesta_opcion(encuesta_id);

CREATE TABLE IF NOT EXISTS encuesta_voto (
  id             BIGSERIAL PRIMARY KEY,
  encuesta_id    BIGINT NOT NULL REFERENCES encuesta(id) ON DELETE CASCADE,
  opcion_id      BIGINT NOT NULL REFERENCES encuesta_opcion(id) ON DELETE CASCADE,
  usuario_id     BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (encuesta_id, usuario_id)
);
CREATE INDEX IF NOT EXISTS idx_encuesta_voto_opcion ON encuesta_voto(opcion_id);
