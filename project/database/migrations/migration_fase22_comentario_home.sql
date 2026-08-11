-- =========================================================
-- Migración Fase 22 — Comentarios de Home (nivel foro global)
-- =========================================================
-- Idempotente. Para la base de DESARROLLO (udelarhits).
-- Reflejado también en schema.sql (la base de test se recrea desde ahí).
--
-- Hasta ahora un comentario vivía SIEMPRE dentro de un tema o de una categoría
-- (CHECK que exigía exactamente uno de los dos). Esta fase agrega un tercer
-- ámbito: el comentario de HOME, un comentario de primer nivel que no pertenece
-- a ninguna categoría ni tema — vive en el foro a nivel global y se mezcla con
-- las categorías en el feed del Home.
--
-- El ámbito home NO se deja implícito en "los dos FK en NULL": se marca con un
-- flag explícito `es_home`, de modo que un bug que olvide setear categoria/tema
-- no pueda crear comentarios huérfanos. El nuevo CHECK exige que exactamente UNO
-- de los tres ámbitos esté presente (tema, categoría o home).
--
-- Sobre datos existentes: toda fila actual tiene exactamente uno de tema_id /
-- categoria_id (por el CHECK anterior), así que quedan con es_home = FALSE, que
-- satisface el nuevo CHECK sin migración de datos.
--
-- Ejecutar:
--   psql -h localhost -U <usuario> -d udelarhits -f migrations/migration_fase22_comentario_home.sql
-- =========================================================

BEGIN;

-- Flag explícito de ámbito home. Default FALSE para que las filas existentes
-- (todas con tema o categoría) queden válidas bajo el nuevo CHECK.
ALTER TABLE comentario
  ADD COLUMN IF NOT EXISTS es_home BOOLEAN NOT NULL DEFAULT FALSE;

-- Tres ámbitos mutuamente excluyentes: exactamente uno presente.
ALTER TABLE comentario DROP CONSTRAINT IF EXISTS comentario_target_check;
ALTER TABLE comentario ADD CONSTRAINT comentario_target_check CHECK (
  (tema_id IS NOT NULL)::int + (categoria_id IS NOT NULL)::int + (es_home)::int = 1
);

-- Índice parcial para el stream de comentarios de Home del feed (solo las filas
-- home, que son una fracción del total).
CREATE INDEX IF NOT EXISTS idx_comentario_home
  ON comentario(contenido_id) WHERE es_home = TRUE;

COMMIT;
