-- =========================================================
-- Migración: índice para el filtro exacto por etiqueta
-- Origen: filtro ?etiqueta= de la búsqueda de categorías
--
-- La PK de categoria_etiqueta es (categoria_id, etiqueta_id), así que un
-- filtro que entra por etiqueta_id (EXISTS ... WHERE ce.etiqueta_id = e.id
-- del filtro ?etiqueta=) NO aprovecha el índice compuesto: etiqueta_id es su
-- segundo campo. Este índice cubre ese acceso.
--
-- Idempotente: IF NOT EXISTS. En una base con datos en vivo puede correrse
-- como CREATE INDEX CONCURRENTLY (fuera de transacción) para no bloquear
-- escrituras; en dev alcanza tal cual está.
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_cat_etiqueta_etiqueta
  ON categoria_etiqueta (etiqueta_id);
