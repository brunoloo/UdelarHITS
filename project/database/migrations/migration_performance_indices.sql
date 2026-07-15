-- =========================================================
-- Migración: índices de performance
-- Origen: AUDITORIA_PERFORMANCE.md §6 (hallazgos ALTO y MEDIO)
--
-- Idempotente: todos los CREATE INDEX usan IF NOT EXISTS.
-- En una base con datos y tráfico en vivo, cada CREATE INDEX puede
-- ejecutarse como CREATE INDEX CONCURRENTLY (fuera de transacción)
-- para no bloquear escrituras. En dev alcanza tal cual está.
--
-- Índices evaluados y descartados a propósito (para no crear de más):
--   * reaccion(usuario_id): lo cubre el prefijo del UNIQUE
--     (usuario_id, contenido_id) existente.
--   * usuario(estado): baja selectividad; todas las queries que filtran
--     estado ya entran por nickname/id o escanean la tabla entera igual
--     (búsqueda con ILIKE '%..%').
--   * tema(estado) / apelacion(estado): ya existen en el schema.
-- =========================================================

-- ---------------------------------------------------------
-- IMPACTO ALTO
-- ---------------------------------------------------------

-- Comentarios directos de una categoría. PostgreSQL no indexa FKs solo:
-- lo usan getRepliesByCategoryId, el contador_comentarios de las cards del
-- Home (una subquery POR categoría) y el scoring del feed personalizado.
-- Parcial: la mitad de las filas (comentarios de tema) tienen categoria_id
-- NULL y no aportan al índice.
CREATE INDEX IF NOT EXISTS idx_comentario_categoria
  ON comentario (categoria_id) WHERE categoria_id IS NOT NULL;

-- Orden y ventanas temporales sobre contenido: ORDER BY fecha_creacion en
-- recientes/feeds y filtros "últimos N días" de populares/trending.
CREATE INDEX IF NOT EXISTS idx_contenido_fecha
  ON contenido (fecha_creacion);

-- TODOS los lookups de usuario usan LOWER(nickname)/LOWER(email)
-- (login, /users/me, perfiles, follow, chat por nickname). El UNIQUE
-- existente es sobre la columna cruda y NO aplica a esos predicados:
-- cada lookup era un seq scan de usuario.
--
-- Antes de correr esto en una base con datos, verificar que no existan
-- duplicados que difieran solo en mayúsculas (romperían el CREATE UNIQUE):
--   SELECT LOWER(nickname), COUNT(*) FROM usuario GROUP BY 1 HAVING COUNT(*) > 1;
--   SELECT LOWER(email),    COUNT(*) FROM usuario GROUP BY 1 HAVING COUNT(*) > 1;
-- (la app ya valida unicidad case-insensitive al registrar, así que no
-- debería haber; el índice convierte esa regla de aplicación en garantía.)
CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_nickname_lower
  ON usuario (LOWER(nickname));

CREATE UNIQUE INDEX IF NOT EXISTS uq_usuario_email_lower
  ON usuario (LOWER(email));

-- ---------------------------------------------------------
-- IMPACTO MEDIO
-- ---------------------------------------------------------

-- Seguidores de un usuario: el PK (seguidor_id, seguido_id) no sirve para
-- entrar por seguido_id (getFollowersByUserId, acceptAllPendingFollowRequests).
-- Incluye estado porque las queries filtran 'aceptado'/'pendiente'.
CREATE INDEX IF NOT EXISTS idx_seguidor_seguido
  ON usuario_seguidor (seguido_id, estado);

-- Conteo de mensajes no leídos (badge de chat y lista de conversaciones).
-- Parcial: solo filas con leido = FALSE — el índice queda mínimo y el
-- COUNT del badge no recorre el historial completo de cada conversación.
CREATE INDEX IF NOT EXISTS idx_mensaje_no_leido
  ON mensaje (conversacion_id, autor_id) WHERE leido = FALSE;

-- Dedup de notificaciones: notificationExists filtra por (tipo, actor_id
-- [, contenido_id | usuario_id]) y corre en CADA like. Sin índice sobre
-- actor_id era un seq scan de notificacion por like.
CREATE INDEX IF NOT EXISTS idx_notificacion_actor
  ON notificacion (actor_id, tipo);

-- FK notificacion.contenido_id es ON DELETE SET NULL: cada borrado de un
-- contenido escaneaba notificacion completa para encontrar referencias.
CREATE INDEX IF NOT EXISTS idx_notificacion_contenido
  ON notificacion (contenido_id);

-- Suscriptores de una categoría (fanout de notificaciones al comentar) y
-- participantes (listado del moderador): ambos PK empiezan por usuario_id,
-- estas queries entran por categoria_id.
CREATE INDEX IF NOT EXISTS idx_suscripcion_categoria_categoria
  ON suscripcion_categoria (categoria_id);

CREATE INDEX IF NOT EXISTS idx_participacion_categoria_categoria
  ON participacion_categoria (categoria_id);

-- ---------------------------------------------------------
-- FKs sin índice usadas en WHERE o en chequeos de borrado (costo ~cero,
-- evitan seq scans puntuales)
-- ---------------------------------------------------------

-- Historial de ediciones: get*EditHistory filtra por la FK del item.
CREATE INDEX IF NOT EXISTS idx_hist_edicion_comentario
  ON historial_edicion_comentario (comentario_id);

CREATE INDEX IF NOT EXISTS idx_hist_edicion_tema
  ON historial_edicion_tema (tema_id);

CREATE INDEX IF NOT EXISTS idx_hist_edicion_categoria
  ON historial_edicion_categoria (categoria_id);

-- apelacion.autor_id es FK ON DELETE RESTRICT: el chequeo al borrar un
-- usuario escaneaba apelacion completa. Ninguna query de lectura filtra por
-- esta columna hoy — es higiene del constraint, no un hot path.
CREATE INDEX IF NOT EXISTS idx_apelacion_autor
  ON apelacion (autor_id);
