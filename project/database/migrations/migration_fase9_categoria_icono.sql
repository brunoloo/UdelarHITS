-- =========================================================
-- Migración Fase 9 — Ícono de categoría
-- =========================================================
-- Idempotente. Para la base de DESARROLLO (udelarhits).
-- Reflejado también en schema.sql (la base de test se recrea desde ahí).
--
-- Ejecutar:
--   psql -h localhost -U <usuario> -d udelarhits -f migrations/migration_fase9_categoria_icono.sql
-- =========================================================

BEGIN;

-- icono: nombre (estilo Lucide) del ícono de la categoría. Las filas existentes
-- quedan con 'grid' (DEFAULT). Ver backend/src/config/categoryIcons.js para el set permitido.
ALTER TABLE categoria
  ADD COLUMN IF NOT EXISTS icono VARCHAR(50) NOT NULL DEFAULT 'grid';

COMMIT;
