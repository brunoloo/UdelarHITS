import pool from '../config/db.js';

// ---------------------------------------------------------
// Inserta una apelación. El título lo arma el service (no el usuario).
// El UNIQUE parcial uq_apelacion_pendiente atrapa el doble-submit (23505).
// ---------------------------------------------------------
const createAppeal = async ({ contenido_id, autor_id, titulo, justificacion }) => {
  const q = `
    INSERT INTO apelacion (contenido_id, autor_id, titulo, justificacion)
    VALUES ($1, $2, $3, $4)
    RETURNING id, contenido_id, autor_id, titulo, justificacion, estado, fecha_solicitud
  `;
  const { rows } = await pool.query(q, [contenido_id, autor_id, titulo, justificacion]);
  return rows[0];
};

// ---------------------------------------------------------
// ¿Ya hay una apelación pendiente sobre este contenido?
// ---------------------------------------------------------
const hasPendingAppeal = async (contenidoId) => {
  const q = `
    SELECT EXISTS(
      SELECT 1 FROM apelacion WHERE contenido_id = $1 AND estado = 'pendiente'
    ) AS pendiente
  `;
  const { rows } = await pool.query(q, [contenidoId]);
  return rows[0].pendiente;
};

// ---------------------------------------------------------
// Trae una apelación por id, con el cuerpo del contenido y su tipo.
// Para la vista de resolución del admin.
// ---------------------------------------------------------
const getAppealById = async (id) => {
  const q = `
    SELECT a.id, a.contenido_id, a.autor_id, a.titulo, a.justificacion,
      a.estado, a.fecha_solicitud,
      con.cuerpo AS contenido_cuerpo,
      CASE WHEN t.contenido_id IS NOT NULL THEN 'tema'
           WHEN c.contenido_id IS NOT NULL THEN 'comentario'
           ELSE NULL END AS tipo
    FROM apelacion a
    JOIN contenido con ON con.id = a.contenido_id
    LEFT JOIN tema t ON t.contenido_id = a.contenido_id
    LEFT JOIN comentario c ON c.contenido_id = a.contenido_id
    WHERE a.id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
};

// ---------------------------------------------------------
// Lista apelaciones pendientes filtradas por tipo ('tema' | 'comentario').
// Los casos de uso piden listas separadas por tipo en el panel admin.
// ---------------------------------------------------------
const getPendingAppealsByType = async (tipo) => {
  const joinFilter =
    tipo === 'tema'
      ? 'JOIN tema t ON t.contenido_id = a.contenido_id'
      : 'JOIN comentario c ON c.contenido_id = a.contenido_id';

  const q = `
    SELECT a.id, a.contenido_id, a.autor_id, a.titulo, a.justificacion,
      a.estado, a.fecha_solicitud,
      u.nickname AS autor_nickname,
      con.cuerpo AS contenido_cuerpo
    FROM apelacion a
    JOIN contenido con ON con.id = a.contenido_id
    JOIN usuario u ON u.id = a.autor_id
    ${joinFilter}
    WHERE a.estado = 'pendiente'
    ORDER BY a.fecha_solicitud ASC
  `;
  const { rows } = await pool.query(q);
  return rows;
};

// ---------------------------------------------------------
// Borra una apelación por id (al resolver se elimina, sea aceptada o
// rechazada). Acepta client para usarse dentro de transacción.
// ---------------------------------------------------------
const deleteAppealById = async (id, client = pool) => {
  const q = `DELETE FROM apelacion WHERE id = $1 RETURNING id`;
  const { rows } = await client.query(q, [id]);
  return rows[0] || null;
};

export { createAppeal, hasPendingAppeal, getAppealById, getPendingAppealsByType, deleteAppealById
};