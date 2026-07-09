import pool from '../config/db.js';

const blockUser = async (bloqueadorId, bloqueadoId) => {
  const q = `
    INSERT INTO bloqueo (bloqueador_id, bloqueado_id)
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING
    RETURNING bloqueador_id, bloqueado_id
  `;
  const { rows } = await pool.query(q, [bloqueadorId, bloqueadoId]);
  return rows[0] || null;
};

const unblockUser = async (bloqueadorId, bloqueadoId) => {
  const q = `
    DELETE FROM bloqueo
    WHERE bloqueador_id = $1 AND bloqueado_id = $2
    RETURNING bloqueador_id, bloqueado_id
  `;
  const { rows } = await pool.query(q, [bloqueadorId, bloqueadoId]);
  return rows[0] || null;
};

const isBlocked = async (userA, userB) => {
  const q = `
    SELECT 1 FROM bloqueo
    WHERE (bloqueador_id = $1 AND bloqueado_id = $2)
       OR (bloqueador_id = $2 AND bloqueado_id = $1)
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [userA, userB]);
  return rows.length > 0;
};

const getBlockDirection = async (userA, userB) => {
  const q = `
    SELECT bloqueador_id, bloqueado_id FROM bloqueo
    WHERE (bloqueador_id = $1 AND bloqueado_id = $2)
       OR (bloqueador_id = $2 AND bloqueado_id = $1)
  `;
  const { rows } = await pool.query(q, [userA, userB]);
  if (rows.length === 0) return null;
  return rows.map(r => ({ bloqueador_id: r.bloqueador_id, bloqueado_id: r.bloqueado_id }));
};

const getBlockedUsers = async (bloqueadorId) => {
  const q = `
    SELECT u.id, u.nickname, u.nombre, u.url_imagen, b.fecha_creacion
    FROM bloqueo b
    JOIN usuario u ON u.id = b.bloqueado_id
    WHERE b.bloqueador_id = $1
    ORDER BY b.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q, [bloqueadorId]);
  return rows;
};

const removeFollowsBothDirections = async (userA, userB) => {
  const q = `
    DELETE FROM usuario_seguidor
    WHERE (seguidor_id = $1 AND seguido_id = $2)
       OR (seguidor_id = $2 AND seguido_id = $1)
  `;
  await pool.query(q, [userA, userB]);
};

export { blockUser, unblockUser, isBlocked, getBlockDirection, getBlockedUsers, removeFollowsBothDirections };
