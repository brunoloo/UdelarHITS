import pool from '../config/db.js';

// El upsert va por endpoint y reasigna usuario_id: en un dispositivo compartido
// recibe los avisos el último que se suscribió.
const upsertSubscription = async ({ usuario_id, endpoint, p256dh, auth, user_agent = null }) => {
  const q = `
    INSERT INTO push_suscripcion (usuario_id, endpoint, p256dh, auth, user_agent)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (endpoint) DO UPDATE SET
      usuario_id = EXCLUDED.usuario_id,
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      user_agent = EXCLUDED.user_agent,
      fecha_creacion = NOW()
    RETURNING id
  `;
  const { rows } = await pool.query(q, [usuario_id, endpoint, p256dh, auth, user_agent]);
  return rows[0];
};

// Acotado al usuario: nadie puede dar de baja el endpoint de otro.
const deleteSubscriptionByEndpoint = async (usuario_id, endpoint) => {
  const q = `DELETE FROM push_suscripcion WHERE usuario_id = $1 AND endpoint = $2 RETURNING id`;
  const { rows } = await pool.query(q, [usuario_id, endpoint]);
  return rows.length;
};

const deleteAllSubscriptions = async (usuario_id) => {
  const q = `DELETE FROM push_suscripcion WHERE usuario_id = $1 RETURNING id`;
  const { rows } = await pool.query(q, [usuario_id]);
  return rows.length;
};

const countSubscriptions = async (usuario_id) => {
  const q = `SELECT COUNT(*)::int AS total FROM push_suscripcion WHERE usuario_id = $1`;
  const { rows } = await pool.query(q, [usuario_id]);
  return rows[0].total;
};

const subscriptionExists = async (usuario_id, endpoint) => {
  const q = `SELECT 1 FROM push_suscripcion WHERE usuario_id = $1 AND endpoint = $2`;
  const { rows } = await pool.query(q, [usuario_id, endpoint]);
  return rows.length > 0;
};

const updatePushEnabled = async (usuario_id, activado) => {
  const q = `UPDATE usuario SET push_activado = $2 WHERE id = $1 RETURNING push_activado`;
  const { rows } = await pool.query(q, [usuario_id, activado]);
  return rows[0] || null;
};

export {
  upsertSubscription,
  deleteSubscriptionByEndpoint,
  deleteAllSubscriptions,
  countSubscriptions,
  subscriptionExists,
  updatePushEnabled,
};
