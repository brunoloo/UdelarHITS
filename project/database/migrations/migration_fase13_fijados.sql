-- Fijar temas/comentarios (moderador de categoría/tema)

BEGIN;

-- El creador de la categoría puede fijar hasta 1 tema y 1 comentario directo.
ALTER TABLE categoria
  ADD COLUMN IF NOT EXISTS tema_fijado_id BIGINT REFERENCES contenido(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS comentario_fijado_id BIGINT REFERENCES contenido(id) ON DELETE SET NULL;

-- El creador del tema puede fijar 1 comentario.
ALTER TABLE tema
  ADD COLUMN IF NOT EXISTS comentario_fijado_id BIGINT REFERENCES contenido(id) ON DELETE SET NULL;

COMMIT;
