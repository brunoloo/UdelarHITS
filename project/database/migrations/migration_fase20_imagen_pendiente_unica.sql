-- Superseding de avatar/banner pendiente de revisión

DELETE FROM imagen_pendiente ip
USING imagen_pendiente mas_nueva
WHERE ip.usuario_id = mas_nueva.usuario_id
  AND ip.tipo = mas_nueva.tipo
  AND ip.id < mas_nueva.id;

-- Índice único: a lo sumo un avatar/banner pendiente por usuario y tipo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_imagen_pendiente_usuario_tipo
  ON imagen_pendiente(usuario_id, tipo);
