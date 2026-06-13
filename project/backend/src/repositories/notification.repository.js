import pool from '../config/db.js';

// =========================================================
// Notification repository
// =========================================================

// Crear una notificación (acepta client para usarse dentro de transacción)
const createNotification = async ({ usuario_id, tipo, mensaje, contenido_id = null }, client = pool) => {
  const q = `
    INSERT INTO notificacion (usuario_id, tipo, mensaje, contenido_id)
    VALUES ($1, $2, $3, $4)
    RETURNING id, usuario_id, tipo, mensaje, contenido_id, leida, fecha_creacion
  `;
  const { rows } = await client.query(q, [usuario_id, tipo, mensaje, contenido_id]);
  return rows[0];
};

// Listar notificaciones de un usuario (más recientes primero)
const getNotificationsByUserId = async (userId, limit = 30) => {
  const q = `
    SELECT id, tipo, mensaje, contenido_id, leida, fecha_creacion
    FROM notificacion
    WHERE usuario_id = $1
    ORDER BY fecha_creacion DESC
    LIMIT $2
  `;
  const { rows } = await pool.query(q, [userId, limit]);
  return rows;
};

// Contar no-leídas (para el badge del leftnav)
const countUnreadByUserId = async (userId) => {
  const q = `SELECT COUNT(*)::int AS total FROM notificacion WHERE usuario_id = $1 AND leida = FALSE`;
  const { rows } = await pool.query(q, [userId]);
  return rows[0].total;
};

// Marcar una notificación como leída
const markNotificationAsRead = async (notifId, userId) => {
  const q = `
    UPDATE notificacion SET leida = TRUE
    WHERE id = $1 AND usuario_id = $2
    RETURNING id, leida
  `;
  const { rows } = await pool.query(q, [notifId, userId]);
  return rows[0] || null;
};

// Traer una notificación por id (verificando que es del usuario)
const getNotificationById = async (notifId, userId) => {
  const q = `
    SELECT id, tipo, mensaje, contenido_id, leida, fecha_creacion
    FROM notificacion
    WHERE id = $1 AND usuario_id = $2
  `;
  const { rows } = await pool.query(q, [notifId, userId]);
  return rows[0] || null;
};

const markAllAsReadByUserId = async (userId) => {
  const q = `UPDATE notificacion SET leida = TRUE WHERE usuario_id = $1 AND leida = FALSE`;
  const { rowCount } = await pool.query(q, [userId]);
  return rowCount;
};

const deleteNotificationById = async (notifId, userId) => {
  const q = `DELETE FROM notificacion WHERE id = $1 AND usuario_id = $2 RETURNING id`;
  const { rows } = await pool.query(q, [notifId, userId]);
  return rows[0] || null;
};

export {
  createNotification,
  getNotificationsByUserId,
  countUnreadByUserId,
  markNotificationAsRead,
  getNotificationById,
  markAllAsReadByUserId,
  deleteNotificationById
};