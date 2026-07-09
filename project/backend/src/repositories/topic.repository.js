import pool from '../config/db.js';
import { TRENDING } from '../config/trendingConfig.js';

const createTopic = async ({ autor_id, categoria_id, titulo, cuerpo }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: contenidoRows } = await client.query(`
      INSERT INTO contenido (autor_id, cuerpo)
      VALUES ($1, $2)
      RETURNING id, fecha_creacion
    `, [autor_id, cuerpo]);
    const contenido = contenidoRows[0];

    const { rows: temaRows } = await client.query(`
      INSERT INTO tema (contenido_id, categoria_id, titulo)
      VALUES ($1, $2, $3)
      RETURNING contenido_id, categoria_id, titulo, estado
    `, [contenido.id, categoria_id, titulo]);
    const tema = temaRows[0];

    await incrementTopicCount(categoria_id, client);

    await client.query('COMMIT');
    return { ...tema, fecha_creacion: contenido.fecha_creacion };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const findTopicByTituloAndCategoria = async (titulo, categoriaId) => {
  const q = `SELECT contenido_id FROM tema
  WHERE unaccent(LOWER(REGEXP_REPLACE(titulo, '\\s+', ' ', 'g'))) = unaccent(LOWER($1)) AND categoria_id = $2 LIMIT 1`;
  const { rows } = await pool.query(q, [titulo, categoriaId]);
  return rows[0] || null;
};

const incrementTopicCountTx = async (categoria_id, client) => {
  await client.query(`
    UPDATE categoria SET contador_temas = contador_temas + 1
    WHERE id = $1
  `, [categoria_id]);
};

const decrementTopicCountTx = async (categoria_id, client) => {
  await client.query(`
    UPDATE categoria SET contador_temas = contador_temas - 1
    WHERE id = $1
  `, [categoria_id]);
};

const getTopics = async () => {
  const q = `
    SELECT t.contenido_id AS id, t.titulo, t.estado, t.categoria_id,
      c.autor_id, u.nickname AS autor_nickname, con.fecha_creacion
    FROM tema t
    JOIN contenido con ON con.id = t.contenido_id
    JOIN usuario u ON u.id = con.autor_id
    JOIN categoria c ON c.id = t.categoria_id
    ORDER BY con.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q);
  return rows;
};

const getTopicById = async (id) => {
  const q = `
    SELECT t.contenido_id AS id, t.titulo, t.estado, t.categoria_id,
      c.titulo AS categoria_titulo, c.estado AS categoria_estado,
      con.cuerpo, con.autor_id,
      u.nickname AS autor_nickname, u.url_imagen AS autor_url_imagen, u.estado AS autor_estado,
      con.fecha_creacion
    FROM tema t
    JOIN contenido con ON con.id = t.contenido_id
    JOIN usuario u ON u.id = con.autor_id
    JOIN categoria c ON c.id = t.categoria_id
    WHERE t.contenido_id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
};

const getTopicsByAuthorId = async (autorId) => {
  const q = `
    SELECT t.contenido_id AS id, t.titulo, t.estado, t.categoria_id,
      c.titulo AS categoria_titulo, con.fecha_creacion
    FROM tema t
    JOIN contenido con ON con.id = t.contenido_id
    JOIN categoria c ON c.id = t.categoria_id
    WHERE con.autor_id = $1
    ORDER BY con.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q, [autorId]);
  return rows;
};

const updateTopicById = async (id, { cuerpo }, editorId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: currentRows } = await client.query(
      `SELECT cuerpo FROM contenido WHERE id = $1`, [id]
    );

    const currentBody = currentRows[0]?.cuerpo;
    if (currentBody != null && currentBody !== cuerpo) {
      await client.query(
        `INSERT INTO historial_edicion_tema (tema_id, contenido_anterior, contenido_nuevo, editor_id)
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

const updateTopicEstado = async (id, estado, motivo = null) => {
  if (estado === 'inactivo') {
    const q = `
      UPDATE tema
      SET estado = 'inactivo',
          titulo = titulo || '_deleted_' || contenido_id,
          motivo_inactivacion = $2,
          fecha_inactivacion = NOW()
      WHERE contenido_id = $1
      RETURNING contenido_id AS id, titulo, estado
    `;
    const { rows } = await pool.query(q, [id, motivo]);
    return rows[0] || null;
  }
 
  // estado 'activo' u otros: comportamiento original + limpieza de moderación
  const q = `
    UPDATE tema
    SET estado = $1,
        motivo_inactivacion = NULL,
        fecha_inactivacion = NULL,
        inactivado_directo = FALSE
    WHERE contenido_id = $2
    RETURNING contenido_id AS id, titulo, estado
  `;
  const { rows } = await pool.query(q, [estado, id]);
  return rows[0] || null;
};

const incrementTopicCount = async (categoriaId) => {
  await pool.query(`
    UPDATE categoria SET contador_temas = contador_temas + 1 WHERE id = $1
  `, [categoriaId]);
};

const decrementTopicCount = async (categoriaId) => {
  await pool.query(`
    UPDATE categoria SET contador_temas = contador_temas - 1 WHERE id = $1
  `, [categoriaId]);
};

const getTopicsByUserId = async (userId) => {
  const q = `
    SELECT t.contenido_id AS id, t.titulo, t.estado, t.categoria_id, con.cuerpo,
      CASE WHEN c.estado = 'inactiva' THEN NULL ELSE c.titulo END AS categoria_titulo,
      c.estado AS categoria_estado, con.fecha_creacion,
      (SELECT COUNT(*) FROM comentario com
          WHERE com.tema_id = t.contenido_id
            AND com.estado = 'visible'
            AND com.comentario_padre_id IS NULL
        ) AS contador_comentarios
    FROM tema t
    JOIN contenido con ON con.id = t.contenido_id
    JOIN categoria c ON c.id = t.categoria_id
    WHERE con.autor_id = $1 AND t.estado = 'activo'
    ORDER BY con.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q, [userId]);
  return rows;
};

const topicHasContent = async (id) => {
  const q = `
    SELECT EXISTS(
      SELECT 1 FROM comentario WHERE tema_id = $1
    ) AS has_content
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0].has_content;
};

const hardDeleteTopicById = async (id) => {
  const q = `DELETE FROM contenido WHERE id = $1`;
  await pool.query(q, [id]);
};

const cleanupInactiveTopics = async (categoryId) => {
  const q = `
    DELETE FROM contenido
    WHERE id IN (
      SELECT t.contenido_id
      FROM tema t
      WHERE t.categoria_id = $1
      AND t.estado = 'inactivo'
      AND NOT EXISTS (
        SELECT 1 FROM comentario c WHERE c.tema_id = t.contenido_id
      )
    )
  `;
  await pool.query(q, [categoryId]);
};

const getRecentTopics = async (limit = 20) => {
  const q = `
    SELECT t.contenido_id AS id, t.titulo, t.estado,
      con.cuerpo, con.fecha_creacion, con.autor_id,
      u.nickname AS autor_nickname, u.url_imagen AS autor_url_imagen, u.estado AS autor_estado,
      t.categoria_id, cat.titulo AS categoria_titulo,
      (SELECT COUNT(*) FROM comentario com 
        WHERE com.tema_id = t.contenido_id 
          AND com.estado = 'visible'
          AND com.comentario_padre_id IS NULL
      ) AS contador_comentarios
    FROM tema t
    JOIN contenido con ON con.id = t.contenido_id
    JOIN usuario u ON u.id = con.autor_id
    JOIN categoria cat ON cat.id = t.categoria_id
    WHERE t.estado = 'activo' AND cat.estado = 'activa'
    ORDER BY con.fecha_creacion DESC
    LIMIT $1
  `;
  const { rows } = await pool.query(q, [limit]);
  return rows;
};

const getTrendingTopic = async (days = 7) => {
  const q = `
    WITH tema_actividad AS (
      SELECT t.contenido_id AS tema_id,
        COUNT(com.contenido_id) AS comentarios_recientes,
        SUM(POWER(0.5, GREATEST(EXTRACT(EPOCH FROM (NOW() - con_com.fecha_creacion)) / 3600.0, 0) / $2)) AS score
      FROM tema t
      JOIN categoria cat ON cat.id = t.categoria_id
      JOIN comentario com ON com.tema_id = t.contenido_id AND com.estado = 'visible'
      JOIN contenido con_com ON con_com.id = com.contenido_id
        AND con_com.fecha_creacion > NOW() - MAKE_INTERVAL(days => $1)
      WHERE t.estado = 'activo' AND cat.estado = 'activa'
      GROUP BY t.contenido_id
    )
    SELECT t.contenido_id AS id, t.titulo, t.categoria_id,
      con.cuerpo, con.fecha_creacion, con.autor_id,
      u.nickname AS autor_nickname, u.url_imagen AS autor_url_imagen, u.estado AS autor_estado,
      cat.titulo AS categoria_titulo,
      ta.comentarios_recientes AS total_comentarios,
      (
        SELECT json_agg(preview ORDER BY preview.fecha DESC)
        FROM (
          SELECT con2.cuerpo AS texto, u2.nickname AS autor, u2.url_imagen AS autor_imagen,
            con2.fecha_creacion AS fecha
          FROM comentario c2
          JOIN contenido con2 ON con2.id = c2.contenido_id
          JOIN usuario u2 ON u2.id = con2.autor_id
          WHERE c2.tema_id = t.contenido_id AND c2.estado = 'visible'
            AND c2.comentario_padre_id IS NULL
          ORDER BY con2.fecha_creacion DESC
          LIMIT 3
        ) preview
      ) AS comentarios_preview
    FROM tema_actividad ta
    JOIN tema t ON t.contenido_id = ta.tema_id
    JOIN contenido con ON con.id = t.contenido_id
    JOIN usuario u ON u.id = con.autor_id
    JOIN categoria cat ON cat.id = t.categoria_id
    ORDER BY ta.score DESC, ta.comentarios_recientes DESC, con.fecha_creacion DESC
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [days, TRENDING.HALF_LIFE_HOURS]);
  return rows[0] || null;
};

const moderateDeactivateTopicTx = async (id, client) => {
  const q = `
    UPDATE tema
    SET estado = 'inactivo',
        titulo = titulo || '_deleted_' || contenido_id,
        motivo_inactivacion = 'moderacion_reporte',
        fecha_inactivacion = NOW(),
        inactivado_directo = TRUE
    WHERE contenido_id = $1 AND estado = 'activo'
    RETURNING contenido_id AS id, categoria_id, estado
  `;
  const { rows } = await client.query(q, [id]);
  return rows[0] || null;
};

const moderateHideTopicRepliesTx = async (temaId, client) => {
  const q = `
    UPDATE comentario
    SET estado = 'oculto',
        motivo_inactivacion = 'moderacion_reporte',
        fecha_inactivacion = NOW(),
        inactivado_directo = FALSE
    WHERE tema_id = $1 AND estado = 'visible'
  `;
  const { rowCount } = await client.query(q, [temaId]);
  return rowCount;
};

const decrementTopicCountTxModeration = async (categoriaId, client) => {
  await client.query(`
    UPDATE categoria SET contador_temas = contador_temas - 1
    WHERE id = $1 AND contador_temas > 0
  `, [categoriaId]);
};

const reactivateTopicTx = async (id, client) => {
  const q = `
    UPDATE tema
    SET estado = 'activo',
        titulo = regexp_replace(titulo, '_deleted_' || contenido_id || '$', ''),
        motivo_inactivacion = NULL,
        fecha_inactivacion = NULL,
        inactivado_directo = FALSE
    WHERE contenido_id = $1 AND estado = 'inactivo'
    RETURNING contenido_id AS id, categoria_id, titulo, estado
  `;
  const { rows } = await client.query(q, [id]);
  return rows[0] || null;
};

const restoreDraggedRepliesTx = async (temaId, client) => {
  const q = `
    UPDATE comentario
    SET estado = 'visible',
        motivo_inactivacion = NULL,
        fecha_inactivacion = NULL
    WHERE tema_id = $1
      AND estado = 'oculto'
      AND motivo_inactivacion = 'moderacion_reporte'
      AND inactivado_directo = FALSE
  `;
  const { rowCount } = await client.query(q, [temaId]);
  return rowCount;
};

const hardDeleteTopicTreeTx = async (temaId, client) => {
  // 1) borrar los contenidos de todos los comentarios del tema
  await client.query(`
    DELETE FROM contenido
    WHERE id IN (SELECT contenido_id FROM comentario WHERE tema_id = $1)
  `, [temaId]);
 
  // 2) borrar el contenido del tema (cascadea a la fila de tema)
  const { rowCount } = await client.query(`DELETE FROM contenido WHERE id = $1`, [temaId]);
  return rowCount;
};

const deleteReportsByContenidoTx = async (contenidoId, client) => {
  await client.query(`DELETE FROM reporte WHERE contenido_id = $1`, [contenidoId]);
};

const getTopicEditHistory = async (topicId) => {
  const q = `
    SELECT h.id, h.contenido_anterior, h.contenido_nuevo,
      h.fecha_edicion, u.nickname AS editor_nickname
    FROM historial_edicion_tema h
    JOIN usuario u ON u.id = h.editor_id
    WHERE h.tema_id = $1
    ORDER BY h.fecha_edicion DESC
  `;
  const { rows } = await pool.query(q, [topicId]);
  return rows;
};

export { createTopic, findTopicByTituloAndCategoria, getTopics, getTopicById, getTopicsByAuthorId, 
  updateTopicById, updateTopicEstado, incrementTopicCount, decrementTopicCount, 
  getTopicsByUserId, topicHasContent, hardDeleteTopicById, cleanupInactiveTopics, 
  getRecentTopics, getTrendingTopic, moderateDeactivateTopicTx, moderateHideTopicRepliesTx, 
  decrementTopicCountTx, reactivateTopicTx, restoreDraggedRepliesTx, hardDeleteTopicTreeTx, deleteReportsByContenidoTx, getTopicEditHistory,
  pinTopicComment, unpinTopicComment };

// ── Comentario fijado por el moderador (creador) del tema ──
async function pinTopicComment(temaId, comentarioId) {
  const q = `
    UPDATE tema SET comentario_fijado_id = $2
    WHERE contenido_id = $1 AND EXISTS (
      SELECT 1 FROM comentario WHERE contenido_id = $2 AND tema_id = $1
        AND comentario_padre_id IS NULL AND estado = 'visible'
    )
    RETURNING contenido_id
  `;
  const { rows } = await pool.query(q, [temaId, comentarioId]);
  return rows[0] || null;
}

async function unpinTopicComment(temaId) {
  await pool.query(`UPDATE tema SET comentario_fijado_id = NULL WHERE contenido_id = $1`, [temaId]);
}