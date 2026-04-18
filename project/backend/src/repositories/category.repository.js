import pool from '../config/db.js';

const createCategory = async ({ titulo, descripcion, autor_id, etiquetas }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const q = `
      INSERT INTO categoria (titulo, descripcion, autor_id)
      VALUES ($1, $2, $3)
      RETURNING id, titulo, descripcion, autor_id, estado, fecha_creacion
    `;
    const { rows } = await client.query(q, [titulo, descripcion, autor_id]);
    const category = rows[0];

    for (const etiqueta of etiquetas) {
      await client.query(
        `INSERT INTO categoria_etiqueta (categoria_id, etiqueta_valor) VALUES ($1, $2)`,
        [category.id, etiqueta]
      );
    }

    // Asignar rol moderador al autor
    await client.query(`
      INSERT INTO participacion_categoria (usuario_id, categoria_id, rol)
      VALUES ($1, $2, 'moderador')
    `, [autor_id, category.id]);

    await client.query('COMMIT');
    return category;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const findCategoryByTitulo = async (titulo) => {
  const q = `SELECT id FROM categoria WHERE LOWER(titulo) = LOWER($1) LIMIT 1`;
  const { rows } = await pool.query(q, [titulo]);
  return rows[0] || null;
};

const getCategories = async () => {
  const q = `
    SELECT c.id, c.titulo, c.descripcion, c.autor_id, u.nickname AS autor_nickname,
      c.estado, c.contador_temas, c.fecha_creacion,
      ARRAY_AGG(ce.etiqueta_valor) AS etiquetas
    FROM categoria c
    LEFT JOIN categoria_etiqueta ce ON ce.categoria_id = c.id
    JOIN usuario u ON u.id = c.autor_id
    GROUP BY c.id, u.nickname
    ORDER BY c.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q);
  return rows;
};

const getCategoryById = async (id) => {
  const q = `
    SELECT c.id, c.titulo, c.descripcion, c.autor_id, c.estado, c.contador_temas, c.fecha_creacion,
      ARRAY_AGG(ce.etiqueta_valor) AS etiquetas
    FROM categoria c
    LEFT JOIN categoria_etiqueta ce ON ce.categoria_id = c.id
    WHERE c.id = $1
    GROUP BY c.id
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
};

const getCategoriesByAuthorId = async (autorId) => {
  const q = `
    SELECT c.id, c.titulo, c.estado, c.fecha_creacion,
      ARRAY_AGG(ce.etiqueta_valor) AS etiquetas
    FROM categoria c
    LEFT JOIN categoria_etiqueta ce ON ce.categoria_id = c.id
    WHERE c.autor_id = $1
    GROUP BY c.id
    ORDER BY c.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q, [autorId]);
  return rows;
};

const getTopicsByCategoryId = async (categoryId) => {
  const q = `
    SELECT t.contenido_id, t.titulo, t.estado, c.fecha_creacion
    FROM tema t
    JOIN contenido c ON c.id = t.contenido_id
    WHERE t.categoria_id = $1
    ORDER BY c.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q, [categoryId]);
  return rows;
};

const deactivateCategoryById = async (id) => {
  const q = `
    UPDATE categoria
    SET estado = 'inactiva'
    WHERE id = $1
    RETURNING id, titulo, estado
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
};

const activeCategoryById = async (id) => {
  const q = `
    UPDATE categoria
    SET estado = 'activa'
    WHERE id = $1
    RETURNING id, titulo, estado
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
};

const updateCategoryById = async (id, { descripcion, etiquetas }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (descripcion !== undefined) {
      await client.query(
        `UPDATE categoria SET descripcion = $1 WHERE id = $2`,
        [descripcion, id]
      );
    }

    if (etiquetas !== undefined) {
      await client.query(
        `DELETE FROM categoria_etiqueta WHERE categoria_id = $1`,
        [id]
      );
      for (const etiqueta of etiquetas) {
        await client.query(
          `INSERT INTO categoria_etiqueta (categoria_id, etiqueta_valor) VALUES ($1, $2)`,
          [id, etiqueta]
        );
      }
    }

    await client.query('COMMIT');

    const { rows } = await client.query(
      `SELECT c.id, c.titulo, c.descripcion, c.estado,
        ARRAY_AGG(ce.etiqueta_valor) AS etiquetas
       FROM categoria c
       LEFT JOIN categoria_etiqueta ce ON ce.categoria_id = c.id
       WHERE c.id = $1
       GROUP BY c.id`,
      [id]
    );
    return rows[0] || null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const assignParticipantRole = async (userId, categoriaId) => {
  const q = `
    INSERT INTO participacion_categoria (usuario_id, categoria_id, rol)
    VALUES ($1, $2, 'participante')
    ON CONFLICT (usuario_id, categoria_id) DO NOTHING
  `;
  await pool.query(q, [userId, categoriaId]);
};


export { createCategory, findCategoryByTitulo, getCategories, getCategoryById, 
  getTopicsByCategoryId, deactivateCategoryById, activeCategoryById, getCategoriesByAuthorId, 
  updateCategoryById, assignParticipantRole };