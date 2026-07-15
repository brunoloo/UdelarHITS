-- =========================================================
-- Migración Fase 19 — Fijar categorías en el Home (solo administradores)
-- =========================================================
-- Idempotente. Para la base de DESARROLLO (udelarhits).
-- Reflejado también en schema.sql (la base de test se recrea desde ahí).
--
-- Un administrador puede fijar UNA categoría para que aparezca primera en el
-- feed del Home durante un tiempo acotado (3 días, 1 semana o 1 mes). Al vencer
-- el plazo la categoría se desancla sola (la vigencia es lógica: las queries del
-- feed sólo consideran fijada la categoría con fijada_hasta > NOW()). El admin
-- también puede desanclarla manualmente (fijada_hasta = NULL) y, si ancla otra
-- estando ya una fijada, la anterior se desancla automáticamente (singleton).
--
-- Ejecutar:
--   psql -h localhost -U <usuario> -d udelarhits -f migrations/migration_fase19_categoria_fijada_home.sql
-- =========================================================

BEGIN;

-- Fecha/hora hasta la que la categoría queda fijada en el Home. NULL = no fijada.
ALTER TABLE categoria
  ADD COLUMN IF NOT EXISTS fijada_hasta TIMESTAMPTZ NULL;

-- A lo sumo una categoría fijada a la vez (singleton global). El índice parcial
-- sobre la constante TRUE de las filas con fijada_hasta NOT NULL garantiza que
-- no puedan coexistir dos categorías fijadas.
CREATE UNIQUE INDEX IF NOT EXISTS uq_categoria_fijada_home
  ON categoria ((fijada_hasta IS NOT NULL))
  WHERE fijada_hasta IS NOT NULL;

COMMIT;
