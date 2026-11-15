-- Fijar comentarios de Home en el Home (solo administradores)

BEGIN;

-- Fecha/hora hasta la que el comentario queda fijado en el Home. NULL = no fijado.
ALTER TABLE comentario
  ADD COLUMN IF NOT EXISTS fijado_home_hasta TIMESTAMPTZ NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_comentario_fijado_home
  ON comentario ((fijado_home_hasta IS NOT NULL))
  WHERE fijado_home_hasta IS NOT NULL;

COMMIT;
