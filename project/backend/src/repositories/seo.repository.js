import pool from '../config/db.js';

// Consultas livianas para metadata y sitemap. Solo exponen contenido activo y público.

export async function getCategorySeoData(id) {
  const q = `
    SELECT id, titulo, descripcion, estado, fecha_creacion
    FROM categoria
    WHERE id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
}

export async function getTopicSeoData(id) {
  const q = `
    SELECT t.contenido_id AS id, t.titulo, t.estado,
      t.categoria_id, c.titulo AS categoria_titulo, c.estado AS categoria_estado,
      con.cuerpo, con.fecha_creacion
    FROM tema t
    JOIN contenido con ON con.id = t.contenido_id
    JOIN categoria c ON c.id = t.categoria_id
    WHERE t.contenido_id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
}

// `estado` y `privado` deciden si la preview puede mostrar datos del perfil.
export async function getProfileSeoData(nickname) {
  const q = `
    SELECT nickname, biografia, url_imagen, estado, privado
    FROM usuario
    WHERE LOWER(nickname) = LOWER($1)
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [nickname]);
  return rows[0] || null;
}

export async function getSitemapCategories() {
  const q = `
    SELECT id, titulo, fecha_creacion
    FROM categoria
    WHERE estado = 'activa'
    ORDER BY fecha_creacion DESC
  `;
  const { rows } = await pool.query(q);
  return rows;
}

export async function getCommentSeoData(id) {
  const q = `
    SELECT c.contenido_id AS id, co.cuerpo, c.estado,
      c.tema_id, c.categoria_id, c.es_home,
      t.titulo AS tema_titulo,
      cat.titulo AS categoria_titulo
    FROM comentario c
    JOIN contenido co ON co.id = c.contenido_id
    LEFT JOIN tema t ON t.contenido_id = c.tema_id
    LEFT JOIN categoria cat ON cat.id = COALESCE(c.categoria_id, t.categoria_id)
    WHERE c.contenido_id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
}

export async function getSitemapTopics() {
  const q = `
    SELECT t.contenido_id AS id, t.titulo, con.fecha_creacion
    FROM tema t
    JOIN contenido con ON con.id = t.contenido_id
    JOIN categoria c ON c.id = t.categoria_id
    WHERE t.estado = 'activo' AND c.estado = 'activa'
    ORDER BY con.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q);
  return rows;
}
