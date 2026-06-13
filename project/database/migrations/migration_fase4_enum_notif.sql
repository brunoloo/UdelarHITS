-- =========================================================
-- Migración Fase 4 — Enum de reportes expandido + Notificaciones
-- =========================================================
-- Idempotente. Para la base de DESARROLLO (udelarhits).
-- Reflejar también en schema.sql (la base de test se recrea desde ahí).
--
-- Ejecutar:
--   psql -h localhost -U <usuario> -d udelarhits -f migrations/migration_fase4_enum_notif.sql
--
-- NOTA: ALTER TYPE ... ADD VALUE IF NOT EXISTS requiere PostgreSQL 12+.
-- =========================================================

-- ---------------------------------------------------------
-- 1. Expandir enum motivo_reporte (4 valores nuevos)
-- ---------------------------------------------------------
-- Los ADD VALUE no van dentro de BEGIN/COMMIT en PG < 12.
-- En PG 12+ funciona, pero por seguridad los dejamos fuera de transacción.
-- IF NOT EXISTS los hace idempotentes.

ALTER TYPE motivo_reporte ADD VALUE IF NOT EXISTS 'acoso';
ALTER TYPE motivo_reporte ADD VALUE IF NOT EXISTS 'contenidoInapropiado';
ALTER TYPE motivo_reporte ADD VALUE IF NOT EXISTS 'informacionEnganosa';
ALTER TYPE motivo_reporte ADD VALUE IF NOT EXISTS 'suplantacion';

-- ---------------------------------------------------------
-- 2. Tabla de notificaciones
-- ---------------------------------------------------------
-- Registra eventos dirigidos a un usuario (ej: "tu contenido fue moderado").
-- Hoy la usa la moderación; mañana la usan notificaciones generales
-- (nuevos seguidores, respuestas, etc.).
--
-- contenido_id es nullable con ON DELETE SET NULL: si el contenido se
-- hard-deletea (apelación rechazada), la notificación sigue existiendo
-- pero sin referencia al contenido — el usuario igual ve el mensaje.

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