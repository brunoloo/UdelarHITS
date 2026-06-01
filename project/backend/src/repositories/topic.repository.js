import pool from '../config/db.js';

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
      u.nickname AS autor_nickname, u.url_imagen AS autor_url_imagen,
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

const updateTopicById = async (id, { cuerpo }) => {
  const q = `
    UPDATE contenido SET cuerpo = $1
    WHERE id = $2
    RETURNING id, cuerpo, fecha_creacion
  `;
  const { rows } = await pool.query(q, [cuerpo, id]);
  return rows[0] || null;
};

const updateTopicEstado = async (id, estado) => {
  const suffix = estado === 'inactivo' ? `, titulo = titulo || '_deleted_' || contenido_id` : '';
  const q = `
    UPDATE tema SET estado = $1${suffix}
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
    SELECT t.contenido_id AS id, t.titulo, t.estado, t.categoria_id,
      CASE WHEN c.estado = 'inactiva' THEN NULL ELSE c.titulo END AS categoria_titulo,
      c.estado AS categoria_estado, con.fecha_creacion
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
      u.nickname AS autor_nickname, u.url_imagen AS autor_url_imagen,
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
        COUNT(com.contenido_id) AS comentarios_recientes
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
      u.nickname AS autor_nickname, u.url_imagen AS autor_url_imagen,
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
          ORDER BY con2.fecha_creacion DESC
          LIMIT 3
        ) preview
      ) AS comentarios_preview
    FROM tema_actividad ta
    JOIN tema t ON t.contenido_id = ta.tema_id
    JOIN contenido con ON con.id = t.contenido_id
    JOIN usuario u ON u.id = con.autor_id
    JOIN categoria cat ON cat.id = t.categoria_id
    ORDER BY ta.comentarios_recientes DESC, con.fecha_creacion DESC
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [days]);
  return rows[0] || null;
};

export { createTopic, findTopicByTituloAndCategoria, getTopics, getTopicById, getTopicsByAuthorId, 
  updateTopicById, updateTopicEstado, incrementTopicCount, decrementTopicCount, 
  getTopicsByUserId, topicHasContent, hardDeleteTopicById, cleanupInactiveTopics, 
  getRecentTopics, getTrendingTopic };