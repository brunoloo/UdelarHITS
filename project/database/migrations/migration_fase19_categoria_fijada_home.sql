-- Fijar categorías en el Home (solo administradores)

BEGIN;

-- Fecha/hora hasta la que la categoría queda fijada en el Home. NULL = no fijada.
ALTER TABLE categoria
  ADD COLUMN IF NOT EXISTS fijada_hasta TIMESTAMPTZ NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_categoria_fijada_home
  ON categoria ((fijada_hasta IS NOT NULL))
  WHERE fijada_hasta IS NOT NULL;

COMMIT;
