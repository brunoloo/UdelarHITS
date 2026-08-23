-- =========================================================
-- Migración Fase 23 — Fijar comentarios de Home en el Home (solo administradores)
-- =========================================================
-- Idempotente. Para la base de DESARROLLO (udelarhits).
-- Reflejado también en schema.sql (la base de test se recrea desde ahí).
--
-- Un administrador puede fijar UN comentario de Home de primer nivel (es_home =
-- TRUE, sin comentario_padre) para que aparezca primero en el feed del Home
-- durante un tiempo acotado (3 días, 1 semana o 1 mes). Al vencer el plazo se
-- desancla solo (la vigencia es lógica: el feed sólo trata como fijado el
-- comentario con fijado_home_hasta > NOW()). El admin también puede desanclarlo
-- manualmente (fijado_home_hasta = NULL).
--
-- El destacado del Home es un singleton COMPARTIDO con la categoría fijada
-- (ver fase 19): fijar un comentario desancla la categoría fijada vigente y
-- viceversa, de modo que a lo sumo un ítem encabeza el Home a la vez. Ese
-- cruce entre tablas se garantiza en la lógica de los repositorios; acá el
-- índice parcial sólo asegura que no coexistan dos comentarios fijados.
--
-- Ejecutar:
--   psql -h localhost -U <usuario> -d udelarhits -f migrations/migration_fase23_comentario_fijado_home.sql
-- =========================================================

BEGIN;

-- Fecha/hora hasta la que el comentario queda fijado en el Home. NULL = no fijado.
ALTER TABLE comentario
  ADD COLUMN IF NOT EXISTS fijado_home_hasta TIMESTAMPTZ NULL;

-- A lo sumo un comentario fijado a la vez (singleton). El índice parcial sobre
-- la constante TRUE de las filas con fijado_home_hasta NOT NULL garantiza que no
-- puedan coexistir dos comentarios fijados.
CREATE UNIQUE INDEX IF NOT EXISTS uq_comentario_fijado_home
  ON comentario ((fijado_home_hasta IS NOT NULL))
  WHERE fijado_home_hasta IS NOT NULL;

COMMIT;
