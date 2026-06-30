-- =========================================================
-- Migración: borrado de chat por usuario
-- =========================================================
-- Agrega columnas para soft-delete per-user de conversaciones.
-- Cuando un usuario "borra" el chat, se marca la fecha; los mensajes
-- anteriores a esa fecha no se muestran para ese usuario.
--
-- Ejecutar:
--   psql -h localhost -U <usuario> -d udelarhits -f migrations/migration_chat_delete.sql
-- =========================================================

BEGIN;

ALTER TABLE conversacion
  ADD COLUMN IF NOT EXISTS borrado_por_usuario1_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS borrado_por_usuario2_at TIMESTAMPTZ;

COMMIT;
