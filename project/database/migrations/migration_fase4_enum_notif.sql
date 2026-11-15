-- Enum de reportes expandido + Notificaciones

ALTER TYPE motivo_reporte ADD VALUE IF NOT EXISTS 'acoso';
ALTER TYPE motivo_reporte ADD VALUE IF NOT EXISTS 'contenidoInapropiado';
ALTER TYPE motivo_reporte ADD VALUE IF NOT EXISTS 'informacionEnganosa';
ALTER TYPE motivo_reporte ADD VALUE IF NOT EXISTS 'suplantacion';

BEGIN;

CREATE TABLE IF NOT EXISTS notificacion (
  id                BIGSERIAL PRIMARY KEY,
  usuario_id        BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  tipo              VARCHAR(50) NOT NULL,
  mensaje           TEXT NOT NULL,
  contenido_id      BIGINT NULL REFERENCES contenido(id) ON DELETE SET NULL,
  leida             BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_creacion    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para listar notificaciones de un usuario (el caso más frecuente)
CREATE INDEX IF NOT EXISTS idx_notificacion_usuario
  ON notificacion (usuario_id, fecha_creacion DESC);

-- Índice parcial para contar no-leídas rápido (badge de campanita)
CREATE INDEX IF NOT EXISTS idx_notificacion_no_leida
  ON notificacion (usuario_id)
  WHERE leida = FALSE;

COMMIT;