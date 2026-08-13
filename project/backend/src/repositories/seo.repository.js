import pool from '../config/db.js';

// ─────────────────────────────────────────────────────────────────────────────
// Repositorio de SEO: queries mínimas y de solo-lectura para inyectar metadata
// en el HTML y generar el sitemap. Son consultas livianas (no arrastran las
// previews/joins pesados del feed) porque las consume el crawler, no la app.
//
// Solo se expone contenido ACTIVO y PÚBLICO:
//   categoría → estado = 'activa'   ·   tema → estado = 'activo'
// El caller (service) decide qué hacer con lo inactivo/inexistente (noindex).
// ─────────────────────────────────────────────────────────────────────────────

// Metadata de una categoría por id. Devuelve estado para que el service pueda
// diferenciar "no existe" de "inactiva" y aplicar noindex en ambos casos.
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

// Metadata de un tema por id (contenido_id), con el título de su categoría
// contenedora y el estado de ambos (tema y categoría) para decidir indexación.
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

// Metadata pública de un perfil por nickname (case-insensitive, igual que el
// resto de los lookups de usuario). Se trae biografía y flags para decidir la
// preview social y el noindex.
export async function getProfileSeoData(nickname) {
  const q = `
    SELECT nickname, biografia, estado, privado
    FROM usuario
    WHERE LOWER(nickname) = LOWER($1)
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [nickname]);
  return rows[0] || null;
}

// Categorías activas para el sitemap: id + título (para el slug) + fecha.
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

// Temas activos (dentro de categorías activas) para el sitemap.
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
