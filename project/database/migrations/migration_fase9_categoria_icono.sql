-- Ícono de categoría

BEGIN;

ALTER TABLE categoria
  ADD COLUMN IF NOT EXISTS icono VARCHAR(50) NOT NULL DEFAULT 'grid';

COMMIT;
