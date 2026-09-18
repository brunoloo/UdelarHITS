-- =========================================================
-- Migración Fase 25 — Notificaciones push (Web Push)
-- =========================================================
-- Idempotente. Para la base de DESARROLLO (udelarhits).
-- Reflejado también en schema.sql (la base de test se recrea desde ahí).
--
-- Dos cambios:
--
-- 1) `usuario.push_activado` — apagado explícito del lado del servidor.
--    DEFAULT TRUE a propósito: sin fila en `push_suscripcion` no sale ningún
--    push, y sin permiso del navegador no hay suscripción; la barrera real es
--    el permiso del SO, no esta columna. Con TRUE, aceptar el permiso alcanza
--    (un solo gesto); con FALSE haría falta un segundo click invisible para el
--    usuario, peor UX y sin ninguna ganancia de privacidad.
--
-- 2) `push_suscripcion` — una fila por dispositivo/navegador suscripto.
--    `endpoint` es la clave natural (lo emite el push service: FCM, APNs,
--    Mozilla) y ya identifica de forma única a la instalación, así que el upsert
--    va por ahí. Reinstalar la PWA o limpiar los datos del sitio genera un
--    endpoint NUEVO: sin el UNIQUE las filas muertas se acumularían.
--    Las filas se borran solas cuando el push service responde 404/410
--    (suscripción caducada); un 429/500/503 es transitorio y NO borra nada.
--
-- Sin enums: ninguno de los campos tiene un dominio cerrado.
--
-- Ejecutar:
--   psql -h localhost -U <usuario> -d udelarhits -f migrations/migration_fase25_push_suscripcion.sql
-- =========================================================

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
