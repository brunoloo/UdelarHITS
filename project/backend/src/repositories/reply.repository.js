import pool from '../config/db.js';

const createReply = async ({ autor_id, cuerpo, tema_id, categoria_id }) => {
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
      INSERT INTO comentario (contenido_id, tema_id, categoria_id)
      VALUES ($1, $2, $3)
      RETURNING contenido_id, tema_id, categoria_id, estado
    `, [contenido.id, tema_id || null, categoria_id || null]);
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

const getRepliesByCategoryId = async (categoriaId) => {
  const q = `
    SELECT com.contenido_id AS id, con.cuerpo, u.nickname AS autor_nickname, con.fecha_creacion
    FROM comentario com
    JOIN contenido con ON con.id = com.contenido_id
    JOIN usuario u ON u.id = con.autor_id
    WHERE com.categoria_id = $1 AND com.estado = 'visible'
    ORDER BY con.fecha_creacion ASC
  `;
  const { rows } = await pool.query(q, [categoriaId]);
  return rows;
};

const getRepliesByTopicId = async (topicId) => {
  const q = `
    SELECT com.contenido_id AS id, con.cuerpo, u.nickname AS autor_nickname, con.fecha_creacion
    FROM comentario com
    JOIN contenido con ON con.id = com.contenido_id
    JOIN usuario u ON u.id = con.autor_id
    WHERE com.tema_id = $1 AND com.estado = 'visible'
    ORDER BY con.fecha_creacion ASC
  `;
  const { rows } = await pool.query(q, [topicId]);
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
      COALESCE(t.titulo, cat.titulo) AS destino_titulo,
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
      COALESCE(t.titulo, cat.titulo) AS destino_titulo,
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

const getRepliesByUserId = async (userId) => {
  const q = `
    SELECT com.contenido_id AS id, con.cuerpo, con.fecha_creacion,
      CASE 
        WHEN com.tema_id IS NOT NULL THEN 'tema'
        ELSE 'categoria'
      END AS tipo,
      COALESCE(t.titulo, cat.titulo) AS destino_titulo,
      COALESCE(com.tema_id, com.categoria_id) AS destino_id
    FROM comentario com
    JOIN contenido con ON con.id = com.contenido_id
    LEFT JOIN tema t ON t.contenido_id = com.tema_id
    LEFT JOIN categoria cat ON cat.id = com.categoria_id
    WHERE con.autor_id = $1
    ORDER BY con.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q, [userId]);
  return rows;
};

const updateReplyById = async (id, { cuerpo }) => {
  const q = `
    UPDATE contenido SET cuerpo = $1
    WHERE id = $2
    RETURNING id, cuerpo, fecha_creacion
  `;
  const { rows } = await pool.query(q, [cuerpo, id]);
  return rows[0] || null;
};


export { createReply, getRepliesByCategoryId, getRepliesByTopicId, deleteReplyById, 
  getReplyById, getRepliesByAuthorId, getRepliesByUserId, updateReplyById }