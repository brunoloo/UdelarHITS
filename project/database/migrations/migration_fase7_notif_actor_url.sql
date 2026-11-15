-- Notificaciones de like / respuesta / follow

BEGIN;

ALTER TABLE notificacion
  ADD COLUMN IF NOT EXISTS actor_id BIGINT NULL REFERENCES usuario(id) ON DELETE SET NULL;

-- url: destino al que navega la notificación al clickearla (ej: /topic/5).
ALTER TABLE notificacion
  ADD COLUMN IF NOT EXISTS url VARCHAR(500) NULL;

COMMIT;
