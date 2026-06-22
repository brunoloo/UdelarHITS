import pool from '../config/db.js';

// =========================================================
// Notification repository
// =========================================================

// Crear una notificación (acepta client para usarse dentro de transacción).
// actor_id: quién generó el evento (like/respuesta/follow); null para sistema.
// url: destino navegable al clickear la notificación.
const createNotification = async (
  { usuario_id, tipo, mensaje, contenido_id = null, actor_id = null, url = null },
  client = pool
) => {
  const q = `
    INSERT INTO notificacion (usuario_id, tipo, mensaje, contenido_id, actor_id, url)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, usuario_id, tipo, mensaje, contenido_id, actor_id, url, leida, fecha_creacion
  `;
  const { rows } = await client.query(q, [usuario_id, tipo, mensaje, contenido_id, actor_id, url]);
  return rows[0];
};

// Dedup: ¿ya existe una notificación con este actor + tipo, apuntando al mismo
// contenido (likes/respuestas) o al mismo destinatario (follows)? Evita spam
// cuando alguien hace like/unlike/like o follow/unfollow/follow.
const notificationExists = async (
  { tipo, actor_id, contenido_id = null, usuario_id = null },
  client = pool
) => {
  const conds = ['tipo = $1', 'actor_id = $2'];
  const params = [tipo, actor_id];
  if (contenido_id != null) {
    params.push(contenido_id);
    conds.push(`contenido_id = $${params.length}`);
  }
  if (usuario_id != null) {
    params.push(usuario_id);
    conds.push(`usuario_id = $${params.length}`);
  }
  const q = `SELECT id FROM notificacion WHERE ${conds.join(' AND ')} LIMIT 1`;
  const { rows } = await client.query(q, params);
  return rows.length > 0;
};

// Listar notificaciones de un usuario (más recientes primero).
// JOIN con el actor (nickname/avatar) y con el contenido (preview del cuerpo).
const getNotificationsByUserId = async (userId, limit = 30) => {
  const q = `
    SELECT n.id, n.tipo, n.mensaje, n.contenido_id, n.leida, n.fecha_creacion, n.url,
      a.nickname AS actor_nickname, a.url_imagen AS actor_url_imagen,
      LEFT(c.cuerpo, 100) AS contenido_preview
    FROM notificacion n
    LEFT JOIN usuario a ON a.id = n.actor_id
    LEFT JOIN contenido c ON c.id = n.contenido_id
    WHERE n.usuario_id = $1
    ORDER BY n.fecha_creacion DESC
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
  notificationExists,
  getNotificationsByUserId,
  countUnreadByUserId,
  markNotificationAsRead,
  getNotificationById,
  markAllAsReadByUserId,
  deleteNotificationById
};