-- Suscripción a categoría (campanita)

BEGIN;

CREATE TABLE IF NOT EXISTS suscripcion_categoria (
  usuario_id     BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  categoria_id   BIGINT NOT NULL REFERENCES categoria(id) ON DELETE CASCADE,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, categoria_id)
);

COMMIT;
