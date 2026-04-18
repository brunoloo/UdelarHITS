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

const findTopicByTituloAndCategoria = async (titulo, categoria_id) => {
  const q = `
    SELECT t.contenido_id FROM tema t
    WHERE LOWER(t.titulo) = LOWER($1) AND t.categoria_id = $2
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [titulo, categoria_id]);
  return rows[0] || null;
};

const incrementTopicCount = async (categoria_id, client) => {
  await client.query(`
    UPDATE categoria SET contador_temas = contador_temas + 1
    WHERE id = $1
  `, [categoria_id]);
};

const decrementTopicCount = async (categoria_id, client) => {
  await client.query(`
    UPDATE categoria SET contador_temas = contador_temas - 1
    WHERE id = $1
  `, [categoria_id]);
};

export { createTopic, findTopicByTituloAndCategoria };