import pool from '../config/db.js';

// Totales reales de lo que hoy es visible en el sitio.
const getCommunityStats = async () => {
  const q = `
    SELECT
      (SELECT COUNT(*)::int FROM usuario WHERE estado = 'activo') AS miembros,
      (SELECT COUNT(*)::int FROM categoria WHERE estado = 'activa') AS categorias,
      (SELECT COUNT(*)::int FROM tema t
         JOIN categoria c ON c.id = t.categoria_id
        WHERE t.estado = 'activo' AND c.estado = 'activa') AS temas,
      (SELECT COUNT(*)::int FROM comentario WHERE estado = 'visible') AS comentarios
  `;
  const { rows } = await pool.query(q);
  return rows[0];
};

export { getCommunityStats };
