import pool from '../config/db.js';

export const getOrCreateConversation = async (userAId, userBId) => {
  const u1 = Math.min(userAId, userBId);
  const u2 = Math.max(userAId, userBId);

  const existing = await pool.query(
    'SELECT id FROM conversacion WHERE usuario1_id = $1 AND usuario2_id = $2',
    [u1, u2]
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const { rows } = await pool.query(
    `INSERT INTO conversacion (usuario1_id, usuario2_id)
     VALUES ($1, $2)
     ON CONFLICT (usuario1_id, usuario2_id) DO NOTHING
     RETURNING id`,
    [u1, u2]
  );
  if (rows[0]) return rows[0].id;

  const retry = await pool.query(
    'SELECT id FROM conversacion WHERE usuario1_id = $1 AND usuario2_id = $2',
    [u1, u2]
  );
  return retry.rows[0].id;
};

export const getConversationById = async (convId) => {
  const { rows } = await pool.query(
    'SELECT id, usuario1_id, usuario2_id FROM conversacion WHERE id = $1',
    [convId]
  );
  return rows[0] || null;
};

export const getConversationsByUserId = async (userId) => {
  const q = `
    SELECT
      c.id,
      c.ultimo_mensaje_at,
      c.fecha_creacion,
      CASE WHEN c.usuario1_id = $1 THEN c.usuario2_id ELSE c.usuario1_id END AS otro_id,
      u.nickname AS otro_nickname,
      u.url_imagen AS otro_url_imagen,
      u.estado AS otro_estado,
      (SELECT cuerpo FROM mensaje WHERE conversacion_id = c.id ORDER BY fecha_creacion DESC LIMIT 1) AS ultimo_mensaje,
      (SELECT COUNT(*)::int FROM mensaje WHERE conversacion_id = c.id AND autor_id <> $1 AND leido = FALSE) AS no_leidos
    FROM conversacion c
    JOIN usuario u ON u.id = CASE WHEN c.usuario1_id = $1 THEN c.usuario2_id ELSE c.usuario1_id END
    WHERE c.usuario1_id = $1 OR c.usuario2_id = $1
    ORDER BY c.ultimo_mensaje_at DESC NULLS LAST, c.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q, [userId]);
  return rows;
};

export const getMessages = async (convId, { before, limit = 50 }) => {
  let q, params;
  if (before) {
    q = `SELECT id, conversacion_id, autor_id, cuerpo, leido, fecha_creacion
         FROM mensaje
         WHERE conversacion_id = $1 AND id < $2
         ORDER BY id DESC
         LIMIT $3`;
    params = [convId, before, limit];
  } else {
    q = `SELECT id, conversacion_id, autor_id, cuerpo, leido, fecha_creacion
         FROM mensaje
         WHERE conversacion_id = $1
         ORDER BY id DESC
         LIMIT $2`;
    params = [convId, limit];
  }
  const { rows } = await pool.query(q, params);
  return rows.reverse();
};

export const createMessage = async ({ conversacion_id, autor_id, cuerpo }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO mensaje (conversacion_id, autor_id, cuerpo)
       VALUES ($1, $2, $3)
       RETURNING id, conversacion_id, autor_id, cuerpo, leido, fecha_creacion`,
      [conversacion_id, autor_id, cuerpo]
    );
    await client.query(
      'UPDATE conversacion SET ultimo_mensaje_at = $1 WHERE id = $2',
      [rows[0].fecha_creacion, conversacion_id]
    );
    await client.query(
      `UPDATE mensaje SET leido = TRUE
       WHERE conversacion_id = $1 AND autor_id <> $2 AND leido = FALSE`,
      [conversacion_id, autor_id]
    );
    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const markMessagesAsRead = async (convId, readerId) => {
  const { rowCount } = await pool.query(
    `UPDATE mensaje SET leido = TRUE
     WHERE conversacion_id = $1 AND autor_id <> $2 AND leido = FALSE`,
    [convId, readerId]
  );
  return rowCount;
};

export const userBelongsToConversation = async (convId, userId) => {
  const { rows } = await pool.query(
    'SELECT id FROM conversacion WHERE id = $1 AND (usuario1_id = $2 OR usuario2_id = $2)',
    [convId, userId]
  );
  return rows.length > 0;
};

export const getOtherUserId = async (convId, userId) => {
  const { rows } = await pool.query(
    `SELECT CASE WHEN usuario1_id = $2 THEN usuario2_id ELSE usuario1_id END AS otro_id
     FROM conversacion WHERE id = $1`,
    [convId, userId]
  );
  return rows[0]?.otro_id || null;
};
