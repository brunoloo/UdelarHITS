-- Índices de performance

-- Impacto alto

CREATE INDEX IF NOT EXISTS idx_comentario_categoria
  ON comentario (categoria_id) WHERE categoria_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contenido_fecha
  ON contenido (fecha_creacion);

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_nickname_lower
  ON usuario (LOWER(nickname));

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_email_lower
  ON usuario (LOWER(email));

-- Impacto medio

CREATE INDEX IF NOT EXISTS idx_seguidor_seguido
  ON usuario_seguidor (seguido_id, estado);

CREATE INDEX IF NOT EXISTS idx_mensaje_no_leido
  ON mensaje (conversacion_id, autor_id) WHERE leido = FALSE;

CREATE INDEX IF NOT EXISTS idx_notificacion_actor
  ON notificacion (actor_id, tipo);

CREATE INDEX IF NOT EXISTS idx_notificacion_contenido
  ON notificacion (contenido_id);

CREATE INDEX IF NOT EXISTS idx_suscripcion_categoria_categoria
  ON suscripcion_categoria (categoria_id);

CREATE INDEX IF NOT EXISTS idx_participacion_categoria_categoria
  ON participacion_categoria (categoria_id);

-- Historial de ediciones: get*EditHistory filtra por la FK del item.
CREATE INDEX IF NOT EXISTS idx_hist_edicion_comentario
  ON historial_edicion_comentario (comentario_id);

CREATE INDEX IF NOT EXISTS idx_hist_edicion_tema
  ON historial_edicion_tema (tema_id);

CREATE INDEX IF NOT EXISTS idx_hist_edicion_categoria
  ON historial_edicion_categoria (categoria_id);

CREATE INDEX IF NOT EXISTS idx_apelacion_autor
  ON apelacion (autor_id);
