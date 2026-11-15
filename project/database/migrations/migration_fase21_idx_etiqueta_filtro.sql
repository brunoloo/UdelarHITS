-- Índice para el filtro exacto por etiqueta

CREATE INDEX IF NOT EXISTS idx_cat_etiqueta_etiqueta
  ON categoria_etiqueta (etiqueta_id);
