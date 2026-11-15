-- Notificaciones push (Web Push)

BEGIN;

ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS push_activado BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS push_suscripcion (
  id                BIGSERIAL PRIMARY KEY,
  usuario_id        BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  endpoint          VARCHAR(500) NOT NULL UNIQUE,
  p256dh            TEXT NOT NULL,
  auth              TEXT NOT NULL,
  user_agent        VARCHAR(255) NULL,
  fecha_creacion    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_suscripcion_usuario ON push_suscripcion(usuario_id);

COMMIT;
