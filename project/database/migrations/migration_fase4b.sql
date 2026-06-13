-- =========================================================
-- Migración Fase 4.B — Apelaciones
-- =========================================================
-- Idempotente y no destructiva. Para la base de DESARROLLO (udelarhits).
-- Reflejar también en schema.sql (la base de test se recrea desde ahí).
--
-- Ejecutar:
--   psql -h localhost -U <usuario> -d udelarhits -f migrations/migration_fase4b.sql
-- =========================================================

BEGIN;

-- ---------------------------------------------------------
-- Índice único parcial: una sola apelación PENDIENTE por contenido.
-- Impide el doble-submit (mandar la apelación dos veces antes de que el
-- admin resuelva la primera). Como al resolver se BORRA la fila, en la
-- práctica nunca hay filas no-pendientes, pero el WHERE lo deja correcto
-- igual y barato.
-- ---------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_apelacion_pendiente
  ON apelacion (contenido_id)
  WHERE estado = 'pendiente';

COMMIT;