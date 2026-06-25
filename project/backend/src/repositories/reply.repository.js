import pool from '../config/db.js';

const createReply = async ({ autor_id, cuerpo, tema_id, categoria_id, comentario_padre_id }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: contenidoRows } = await client.query(`
      INSERT INTO contenido (autor_id, cuerpo)
      VALUES ($1, $2)
      RETURNING id, fecha_creacion
    `, [autor_id, cuerpo]);
    const contenido = contenidoRows[0];

    const { rows: comentarioRows } = await client.query(`
      INSERT INTO comentario (contenido_id, tema_id, categoria_id, comentario_padre_id)
      VALUES ($1, $2, $3, $4)
      RETURNING contenido_id, tema_id, categoria_id, comentario_padre_id, estado
    `, [contenido.id, tema_id || null, categoria_id || null, comentario_padre_id || null]);
    const comentario = comentarioRows[0];

    await client.query('COMMIT');
    return { ...comentario, fecha_creacion: contenido.fecha_creacion };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const getRepliesByCategoryId = async (categoriaId, userId = null) => {
  const q = `
    SELECT com.contenido_id AS id, com.estado AS estado, com.motivo_inactivacion,
      con.cuerpo, con.autor_id, u.nickname AS autor_nickname, u.url_imagen AS autor_url_imagen, con.fecha_creacion, u.estado AS autor_estado,
      (SELECT COUNT(*) FROM comentario child WHERE child.comentario_padre_id = com.contenido_id AND child.estado = 'visible') AS contador_respuestas,
      (SELECT COUNT(*) FROM reaccion WHERE contenido_id = com.contenido_id AND tipo = 'meGusta') AS likes,
      (SELECT tipo FROM reaccion WHERE contenido_id = com.contenido_id AND usuario_id = $2 LIMIT 1) AS mi_reaccion
    FROM comentario com
    JOIN contenido con ON con.id = com.contenido_id
    JOIN usuario u ON u.id = con.autor_id
    WHERE com.categoria_id = $1 AND com.comentario_padre_id IS NULL
    ORDER BY con.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q, [categoriaId, userId]);
  return rows;
};

const getRepliesByTopicId = async (topicId, userId = null) => {
  const q = `
    SELECT com.contenido_id AS id, com.estado AS estado, com.motivo_inactivacion,
      con.cuerpo, con.autor_id, u.nickname AS autor_nickname, u.url_imagen AS autor_url_imagen, con.fecha_creacion, u.estado AS autor_estado,
      (SELECT COUNT(*) FROM comentario child WHERE child.comentario_padre_id = com.contenido_id AND child.estado = 'visible') AS contador_respuestas,
      (SELECT COUNT(*) FROM reaccion WHERE contenido_id = com.contenido_id AND tipo = 'meGusta') AS likes,
      (SELECT tipo FROM reaccion WHERE contenido_id = com.contenido_id AND usuario_id = $2 LIMIT 1) AS mi_reaccion
    FROM comentario com
    JOIN contenido con ON con.id = com.contenido_id
    JOIN usuario u ON u.id = con.autor_id
    WHERE com.tema_id = $1 AND com.comentario_padre_id IS NULL
    ORDER BY con.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q, [topicId, userId]);
  return rows;
};

const deleteReplyById = async (id) => {
  const q = `
    DELETE FROM contenido
    WHERE id = $1
    RETURNING id
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
};

const getReplyById = async (id) => {
  const q = `
    SELECT com.contenido_id AS id, con.autor_id, con.cuerpo, com.estado,
      com.tema_id, com.categoria_id, com.comentario_padre_id,
      COALESCE(
        CASE WHEN t.estado = 'inactivo' THEN NULL ELSE t.titulo END,
        CASE WHEN cat.estado = 'inactiva' THEN NULL ELSE cat.titulo END
      ) AS destino_titulo,
      CASE
        WHEN com.tema_id IS NOT NULL THEN 'tema'
        ELSE 'categoria'
      END AS tipo
    FROM comentario com
    JOIN contenido con ON con.id = com.contenido_id
    LEFT JOIN tema t ON t.contenido_id = com.tema_id
    LEFT JOIN categoria cat ON cat.id = com.categoria_id
    WHERE com.contenido_id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
};

const getRepliesByAuthorId = async (autorId) => {
  const q = `
    SELECT com.contenido_id AS id, con.cuerpo, con.fecha_creacion,
      CASE 
        WHEN com.tema_id IS NOT NULL THEN 'tema'
        ELSE 'categoria'
      END AS tipo,
      COALESCE(
        CASE WHEN t.estado = 'inactivo' THEN NULL ELSE t.titulo END,
        CASE WHEN cat.estado = 'inactiva' THEN NULL ELSE cat.titulo END
      ) AS destino_titulo,
      COALESCE(com.tema_id, com.categoria_id) AS destino_id
    FROM comentario com
    JOIN contenido con ON con.id = com.contenido_id
    LEFT JOIN tema t ON t.contenido_id = com.tema_id
    LEFT JOIN categoria cat ON cat.id = com.categoria_id
    WHERE con.autor_id = $1
    ORDER BY con.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q, [autorId]);
  return rows;
};

const getRepliesByUserId = async (userId, viewerId = null) => {
  // Devuelve la forma completa que consume CommentCard (autor, likes,
  // mi_reaccion, contador_respuestas, estado) además de los datos de destino
  // (tema/categoría) para construir el deep-link al comentario en su contexto.
  const q = `
    SELECT com.contenido_id AS id, com.estado, com.motivo_inactivacion,
      con.cuerpo, con.fecha_creacion, con.autor_id,
      u.nickname AS autor_nickname, u.url_imagen AS autor_url_imagen, u.estado AS autor_estado,
      CASE
        WHEN com.tema_id IS NOT NULL THEN 'tema'
        ELSE 'categoria'
      END AS tipo,
      COALESCE(
        CASE WHEN t.estado = 'inactivo' THEN NULL ELSE t.titulo END,
        CASE WHEN cat.estado = 'inactiva' THEN NULL ELSE cat.titulo END
      ) AS destino_titulo,
      COALESCE(com.tema_id, com.categoria_id) AS destino_id,
      CASE
        WHEN com.tema_id IS NOT NULL THEN tc.estado
        ELSE cat.estado
      END AS categoria_estado,
      t.estado AS tema_estado,
      com.comentario_padre_id,
      (SELECT u_p.nickname
         FROM contenido con_p
         JOIN usuario u_p ON u_p.id = con_p.autor_id
        WHERE con_p.id = com.comentario_padre_id) AS padre_autor_nickname,
      (SELECT COUNT(*) FROM comentario child WHERE child.comentario_padre_id = com.contenido_id AND child.estado = 'visible') AS contador_respuestas,
      (SELECT COUNT(*) FROM reaccion WHERE contenido_id = com.contenido_id AND tipo = 'meGusta') AS likes,
      (SELECT tipo FROM reaccion WHERE contenido_id = com.contenido_id AND usuario_id = $2 LIMIT 1) AS mi_reaccion
    FROM comentario com
    JOIN contenido con ON con.id = com.contenido_id
    JOIN usuario u ON u.id = con.autor_id
    LEFT JOIN tema t ON t.contenido_id = com.tema_id
    LEFT JOIN categoria tc ON tc.id = t.categoria_id
    LEFT JOIN categoria cat ON cat.id = com.categoria_id
    WHERE con.autor_id = $1
    ORDER BY con.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q, [userId, viewerId]);
  return rows;
};

const getLikedCommentsByUserId = async (userId, viewerId = null) => {
  // Comentarios a los que el usuario $1 dio "me gusta", en la misma forma que
  // consume CommentCard. El INNER JOIN con comentario excluye reacciones sobre
  // temas. Ordenados por la fecha del like (más reciente primero).
  const q = `
    SELECT com.contenido_id AS id, com.estado, com.motivo_inactivacion,
      con.cuerpo, con.fecha_creacion, con.autor_id,
      u.nickname AS autor_nickname, u.url_imagen AS autor_url_imagen, u.estado AS autor_estado,
      CASE
        WHEN com.tema_id IS NOT NULL THEN 'tema'
        ELSE 'categoria'
      END AS tipo,
      COALESCE(
        CASE WHEN t.estado = 'inactivo' THEN NULL ELSE t.titulo END,
        CASE WHEN cat.estado = 'inactiva' THEN NULL ELSE cat.titulo END
      ) AS destino_titulo,
      COALESCE(com.tema_id, com.categoria_id) AS destino_id,
      CASE
        WHEN com.tema_id IS NOT NULL THEN tc.estado
        ELSE cat.estado
      END AS categoria_estado,
      t.estado AS tema_estado,
      com.comentario_padre_id,
      (SELECT u_p.nickname
         FROM contenido con_p
         JOIN usuario u_p ON u_p.id = con_p.autor_id
        WHERE con_p.id = com.comentario_padre_id) AS padre_autor_nickname,
      (SELECT COUNT(*) FROM comentario child WHERE child.comentario_padre_id = com.contenido_id AND child.estado = 'visible') AS contador_respuestas,
      (SELECT COUNT(*) FROM reaccion WHERE contenido_id = com.contenido_id AND tipo = 'meGusta') AS likes,
      (SELECT tipo FROM reaccion WHERE contenido_id = com.contenido_id AND usuario_id = $2 LIMIT 1) AS mi_reaccion
    FROM reaccion r
    JOIN comentario com ON com.contenido_id = r.contenido_id
    JOIN contenido con ON con.id = com.contenido_id
    JOIN usuario u ON u.id = con.autor_id
    LEFT JOIN tema t ON t.contenido_id = com.tema_id
    LEFT JOIN categoria tc ON tc.id = t.categoria_id
    LEFT JOIN categoria cat ON cat.id = com.categoria_id
    WHERE r.usuario_id = $1 AND r.tipo = 'meGusta'
    ORDER BY r.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q, [userId, viewerId]);
  return rows;
};

const getRepliesByCommentId = async (commentId, userId = null) => {
  const q = `
    SELECT com.contenido_id AS id, com.estado, com.motivo_inactivacion,
      con.cuerpo, con.autor_id, u.nickname AS autor_nickname, u.url_imagen AS autor_url_imagen, con.fecha_creacion, u.estado AS autor_estado,
      (SELECT COUNT(*) FROM comentario child WHERE child.comentario_padre_id = com.contenido_id AND child.estado = 'visible') AS contador_respuestas,
      (SELECT COUNT(*) FROM reaccion WHERE contenido_id = com.contenido_id AND tipo = 'meGusta') AS likes,
      (SELECT tipo FROM reaccion WHERE contenido_id = com.contenido_id AND usuario_id = $2 LIMIT 1) AS mi_reaccion
    FROM comentario com
    JOIN contenido con ON con.id = com.contenido_id
    JOIN usuario u ON u.id = con.autor_id
    WHERE com.comentario_padre_id = $1
    ORDER BY con.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q, [commentId, userId]);
  return rows;
};

const updateReplyById = async (id, { cuerpo }, editorId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: currentRows } = await client.query(
      `SELECT cuerpo FROM contenido WHERE id = $1`, [id]
    );

    const currentBody = currentRows[0]?.cuerpo;
    if (currentBody != null && currentBody !== cuerpo) {
      await client.query(
        `INSERT INTO historial_edicion_comentario (comentario_id, contenido_anterior, contenido_nuevo, editor_id)
         VALUES ($1, $2, $3, $4)`,
        [id, currentBody, cuerpo, editorId]
      );
    }

    const { rows } = await client.query(
      `UPDATE contenido SET cuerpo = $1 WHERE id = $2 RETURNING id, cuerpo, fecha_creacion`,
      [cuerpo, id]
    );

    await client.query('COMMIT');
    return rows[0] || null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const replyHasReplies = async (id) => {
  const q = `
    SELECT EXISTS(
      SELECT 1 FROM comentario WHERE comentario_padre_id = $1
    ) AS has_replies
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0].has_replies;
};

const hideReplyById = async (id, motivo = 'autor') => {
  const q = `
    UPDATE comentario
    SET estado = 'oculto',
        motivo_inactivacion = $2,
        fecha_inactivacion = NOW()
    WHERE contenido_id = $1
    RETURNING contenido_id AS id, estado
  `;
  const { rows } = await pool.query(q, [id, motivo]);
  return rows[0] || null;
};

const getParentComment = async (id) => {
  const q = `
    SELECT com.comentario_padre_id AS padre_id, parent.estado AS padre_estado
    FROM comentario com
    LEFT JOIN comentario parent ON parent.contenido_id = com.comentario_padre_id
    WHERE com.contenido_id = $1
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
};

const moderateHideReply = async (id, client = pool) => {
  const q = `
    UPDATE comentario
    SET estado = 'oculto',
        motivo_inactivacion = 'moderacion_reporte',
        fecha_inactivacion = NOW(),
        inactivado_directo = TRUE
    WHERE contenido_id = $1 AND estado = 'visible'
    RETURNING contenido_id AS id, estado
  `;
  const { rows } = await client.query(q, [id]);
  return rows[0] || null;
};

const reactivateReplyTx = async (id, client) => {
  const q = `
    UPDATE comentario
    SET estado = 'visible',
        motivo_inactivacion = NULL,
        fecha_inactivacion = NULL,
        inactivado_directo = FALSE
    WHERE contenido_id = $1 AND estado = 'oculto'
    RETURNING contenido_id AS id, estado
  `;
  const { rows } = await client.query(q, [id]);
  return rows[0] || null;
};

const hardDeleteReplySubtreeTx = async (id, client) => {
  const q = `
    WITH RECURSIVE subarbol AS (
      SELECT contenido_id FROM comentario WHERE contenido_id = $1
      UNION ALL
      SELECT c.contenido_id
      FROM comentario c
      JOIN subarbol s ON c.comentario_padre_id = s.contenido_id
    )
    DELETE FROM contenido WHERE id IN (SELECT contenido_id FROM subarbol)
  `;
  const { rowCount } = await client.query(q, [id]);
  return rowCount;
};

const getReplyEditHistory = async (commentId) => {
  const q = `
    SELECT h.id, h.contenido_anterior, h.contenido_nuevo,
      h.fecha_edicion, u.nickname AS editor_nickname
    FROM historial_edicion_comentario h
    JOIN usuario u ON u.id = h.editor_id
    WHERE h.comentario_id = $1
    ORDER BY h.fecha_edicion DESC
  `;
  const { rows } = await pool.query(q, [commentId]);
  return rows;
};

const getReplyContext = async (commentId, userId = null) => {
  const q = `
    WITH RECURSIVE ancestors AS (
      SELECT com.contenido_id, com.comentario_padre_id, 0 AS depth
      FROM comentario com
      WHERE com.contenido_id = $1
      UNION ALL
      SELECT p.contenido_id, p.comentario_padre_id, a.depth + 1
      FROM comentario p
      JOIN ancestors a ON a.comentario_padre_id = p.contenido_id
    )
    SELECT
      a.depth,
      com.contenido_id AS id, com.estado, com.motivo_inactivacion,
      con.cuerpo, con.autor_id,
      u.nickname AS autor_nickname, u.url_imagen AS autor_url_imagen,
      con.fecha_creacion, u.estado AS autor_estado,
      (SELECT COUNT(*) FROM comentario child WHERE child.comentario_padre_id = com.contenido_id AND child.estado = 'visible') AS contador_respuestas,
      (SELECT COUNT(*) FROM reaccion WHERE contenido_id = com.contenido_id AND tipo = 'meGusta') AS likes,
      (SELECT tipo FROM reaccion WHERE contenido_id = com.contenido_id AND usuario_id = $2 LIMIT 1) AS mi_reaccion
    FROM ancestors a
    JOIN comentario com ON com.contenido_id = a.contenido_id
    JOIN contenido con ON con.id = com.contenido_id
    JOIN usuario u ON u.id = con.autor_id
    ORDER BY a.depth DESC
  `;
  const { rows } = await pool.query(q, [commentId, userId]);
  return rows;
};

export { createReply, getRepliesByCategoryId, getRepliesByTopicId, deleteReplyById,
  getReplyById, getRepliesByAuthorId, getRepliesByUserId, getRepliesByCommentId, updateReplyById, replyHasReplies,
  hideReplyById, getParentComment, moderateHideReply, reactivateReplyTx, hardDeleteReplySubtreeTx, getReplyEditHistory,
  getReplyContext, getLikedCommentsByUserId }