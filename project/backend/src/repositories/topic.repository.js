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
  WHERE LOWER(REGEXP_REPLACE(titulo, '\\s+', ' ', 'g')) = LOWER($1) AND categoria_id = $2 LIMIT 1`;
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
      c.titulo AS categoria_titulo, c.estado AS categoria_estado, con.fecha_creacion
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

export { createTopic, findTopicByTituloAndCategoria, getTopics, getTopicById, getTopicsByAuthorId, 
  updateTopicById, updateTopicEstado, incrementTopicCount, decrementTopicCount, 
  getTopicsByUserId, topicHasContent, hardDeleteTopicById, cleanupInactiveTopics };