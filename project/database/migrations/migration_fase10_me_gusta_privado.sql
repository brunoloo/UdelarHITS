-- =========================================================
-- Migración Fase 10 — Me gusta privados
-- =========================================================
-- Idempotente. Para la base de DESARROLLO (udelarhits).
-- Reflejado también en schema.sql (la base de test se recrea desde ahí).
--
-- Ejecutar:
--   psql -h localhost -U <usuario> -d udelarhits -f migrations/migration_fase10_me_gusta_privado.sql
-- =========================================================

BEGIN;

-- me_gusta_privado: cuando es TRUE, el contenido al que el usuario dio "me gusta"
-- deja de ser público. La tab "me gusta" del perfil sigue accesible pero muestra
-- un placeholder a quienes no son el dueño.
ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS me_gusta_privado BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
