import pool from '../config/db.js';
import { escapeLike } from '../utils/escapeLike.js';

// Trabajo que espera a un administrador, con el mismo criterio que cada listado del panel.
const countPendingWork = async () => {
  const q = `
    SELECT
      (SELECT COUNT(*)::int FROM apelacion WHERE estado = 'pendiente') AS apelaciones,
      (SELECT COUNT(*)::int FROM reporte_usuario WHERE estado = 'pendiente') AS reportes,
      (SELECT COUNT(*)::int FROM adjunto WHERE estado = 'pendiente_revision')
        + (SELECT COUNT(*)::int FROM imagen_pendiente) AS imagenes
  `;
  const { rows } = await pool.query(q);
  return rows[0];
};

// `estado` y `q` son opcionales; `q` busca en el texto y en el nickname del autor.
const commentFilters = ({ estado = null, q = null }) => {
  const params = [];
  const conds = [];
  if (estado) {
    params.push(estado);
    conds.push(`com.estado = $${params.length}::estado_com`);
  }
  if (q) {
    params.push(`%${escapeLike(q)}%`);
    const ph = `$${params.length}`;
    conds.push(`(con.cuerpo ILIKE ${ph} ESCAPE '\\' OR u.nickname ILIKE ${ph} ESCAPE '\\')`);
  }
  return { params, where: conds.length ? `WHERE ${conds.join(' AND ')}` : '' };
};

// Todos los comentarios del sitio (de Home, de categoría, de tema y respuestas), del más
// nuevo al más viejo, incluidos los ocultos.
const listComments = async ({ estado = null, q = null, limit = 30, offset = 0 } = {}) => {
  const { params, where } = commentFilters({ estado, q });
  params.push(limit, offset);
  const sql = `
    SELECT com.contenido_id AS id, com.estado, com.motivo_inactivacion,
      con.cuerpo, con.fecha_creacion,
      u.nickname AS autor_nickname,
      CASE
        WHEN com.tema_id IS NOT NULL THEN 'tema'
        WHEN com.categoria_id IS NOT NULL THEN 'categoria'
        ELSE 'home'
      END AS tipo,
      COALESCE(com.tema_id, com.categoria_id) AS destino_id,
      COALESCE(t.titulo, cat.titulo) AS destino_titulo,
      (com.comentario_padre_id IS NOT NULL) AS es_respuesta,
      (SELECT COUNT(*)::int FROM adjunto a WHERE a.contenido_id = com.contenido_id) AS adjuntos,
      EXISTS (SELECT 1 FROM encuesta e WHERE e.contenido_id = com.contenido_id) AS tiene_encuesta
    FROM comentario com
    JOIN contenido con ON con.id = com.contenido_id
    JOIN usuario u ON u.id = con.autor_id
    LEFT JOIN tema t ON t.contenido_id = com.tema_id
    LEFT JOIN categoria cat ON cat.id = com.categoria_id
    ${where}
    ORDER BY con.fecha_creacion DESC, com.contenido_id DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const { rows } = await pool.query(sql, params);
  return rows;
};

const countComments = async ({ estado = null, q = null } = {}) => {
  const { params, where } = commentFilters({ estado, q });
  const sql = `
    SELECT COUNT(*)::int AS total
    FROM comentario com
    JOIN contenido con ON con.id = com.contenido_id
    JOIN usuario u ON u.id = con.autor_id
    ${where}
  `;
  const { rows } = await pool.query(sql, params);
  return rows[0].total;
};

export { countPendingWork, listComments, countComments };
