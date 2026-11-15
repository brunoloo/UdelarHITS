import pool from '../config/db.js';
import { getIO } from '../socket.js';
import { isRealtimeEnabled } from '../utils/realtimeMode.js';
import { schedulePushForNotification } from '../utils/sendWebPush.js';

// actor_id es null en notificaciones del sistema. Acepta client para usarse en una transacción.
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
  const notif = rows[0];

  // Con carga alta el aviso en tiempo real se pausa; la notificación queda guardada igual.
  const io = getIO();
  if (io && notif && isRealtimeEnabled()) {
    let actor_nickname = null;
    let actor_url_imagen = null;
    if (actor_id) {
      const actorRes = await pool.query(
        'SELECT nickname, url_imagen FROM usuario WHERE id = $1',
        [actor_id]
      );
      if (actorRes.rows[0]) {
        actor_nickname = actorRes.rows[0].nickname;
        actor_url_imagen = actorRes.rows[0].url_imagen;
      }
    }
    io.to(`user:${usuario_id}`).emit('notificacion:nueva', {
      ...notif,
      actor_nickname,
      actor_url_imagen,
    });
  }

  // Sin await: el envío es diferido y un fallo del servicio de push no debe frenar la operación.
  if (notif) schedulePushForNotification(notif.id);

  return notif;
};

// Evita notificaciones repetidas ante like/unlike/like o follow/unfollow/follow.
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

const getNotificationsByUserId = async (userId, limit = 30) => {
  const q = `
    SELECT n.id, n.tipo, n.mensaje, n.contenido_id, n.leida, n.fecha_creacion, n.url,
      a.nickname AS actor_nickname, a.url_imagen AS actor_url_imagen, a.estado AS actor_estado,
      -- Si el contenido es un tema, mostramos su título; si es comentario, el cuerpo.
      COALESCE(
        (SELECT t.titulo FROM tema t WHERE t.contenido_id = n.contenido_id),
        LEFT(c.cuerpo, 100)
      ) AS contenido_preview,
      -- El front muestra "[foto]"/"[encuesta]" sin sobrecargar el panel.
      EXISTS(SELECT 1 FROM adjunto a WHERE a.contenido_id = n.contenido_id AND a.tipo = 'imagen' AND a.estado = 'publicado') AS tiene_imagen,
      EXISTS(SELECT 1 FROM encuesta e WHERE e.contenido_id = n.contenido_id) AS tiene_encuesta
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

const countUnreadByUserId = async (userId) => {
  const q = `SELECT COUNT(*)::int AS total FROM notificacion WHERE usuario_id = $1 AND leida = FALSE`;
  const { rows } = await pool.query(q, [userId]);
  return rows[0].total;
};

const markNotificationAsRead = async (notifId, userId) => {
  const q = `
    UPDATE notificacion SET leida = TRUE
    WHERE id = $1 AND usuario_id = $2
    RETURNING id, leida
  `;
  const { rows } = await pool.query(q, [notifId, userId]);
  return rows[0] || null;
};

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

// Las solicitudes de seguimiento no se borran: solo se aceptan o se rechazan.
const deleteNotificationById = async (notifId, userId) => {
  const q = `
    DELETE FROM notificacion
    WHERE id = $1 AND usuario_id = $2 AND tipo <> 'solicitud_seguimiento'
    RETURNING id
  `;
  const { rows } = await pool.query(q, [notifId, userId]);
  return rows[0] || null;
};

// Al resolver una solicitud de seguimiento se borra su notificación y se reinicia el dedup.
const deleteNotificationsByActorAndType = async (usuario_id, actor_id, tipo) => {
  const q = `
    DELETE FROM notificacion
    WHERE usuario_id = $1 AND actor_id = $2 AND tipo = $3
    RETURNING id
  `;
  const { rows } = await pool.query(q, [usuario_id, actor_id, tipo]);

  const io = getIO();
  if (io && rows.length > 0 && isRealtimeEnabled()) {
    const ids = rows.map(r => r.id);
    io.to(`user:${usuario_id}`).emit('notificacion:eliminada', { ids });
  }

  return rows.length;
};

// Al pasar a cuenta pública las solicitudes se aceptan solas y sus notificaciones se borran.
const deleteNotificationsByType = async (usuario_id, tipo) => {
  const q = `DELETE FROM notificacion WHERE usuario_id = $1 AND tipo = $2 RETURNING id`;
  const { rows } = await pool.query(q, [usuario_id, tipo]);
  return rows.length;
};

export {
  createNotification,
  notificationExists,
  getNotificationsByUserId,
  countUnreadByUserId,
  markNotificationAsRead,
  getNotificationById,
  markAllAsReadByUserId,
  deleteNotificationById,
  deleteNotificationsByActorAndType,
  deleteNotificationsByType
};