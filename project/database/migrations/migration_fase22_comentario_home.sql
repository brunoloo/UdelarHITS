-- Comentarios de Home (nivel foro global)

BEGIN;

ALTER TABLE comentario
  ADD COLUMN IF NOT EXISTS es_home BOOLEAN NOT NULL DEFAULT FALSE;

-- Tres ámbitos mutuamente excluyentes: exactamente uno presente.
ALTER TABLE comentario DROP CONSTRAINT IF EXISTS comentario_target_check;
ALTER TABLE comentario ADD CONSTRAINT comentario_target_check CHECK (
  (tema_id IS NOT NULL)::int + (categoria_id IS NOT NULL)::int + (es_home)::int = 1
);

CREATE INDEX IF NOT EXISTS idx_comentario_home
  ON comentario(contenido_id) WHERE es_home = TRUE AND comentario_padre_id IS NULL;

COMMIT;
