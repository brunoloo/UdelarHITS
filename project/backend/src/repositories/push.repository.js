import pool from '../config/db.js';

// =========================================================
// Push subscription repository
// =========================================================

// Alta/actualización de una suscripción. El upsert va por `endpoint` (la clave
// natural que emite el push service) y el UPDATE reasigna `usuario_id`: en un
// dispositivo compartido, el último que se suscribe se queda con el endpoint —
// si no, el dueño anterior seguiría recibiendo los pushes de otra persona.
// Las claves se refrescan porque el navegador puede rotarlas manteniendo el
// mismo endpoint.
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

// Baja de un dispositivo puntual. Acotado al usuario: nadie puede desuscribir
// el endpoint de otro mandando su URL.
const deleteSubscriptionByEndpoint = async (usuario_id, endpoint) => {
  const q = `DELETE FROM push_suscripcion WHERE usuario_id = $1 AND endpoint = $2 RETURNING id`;
  const { rows } = await pool.query(q, [usuario_id, endpoint]);
  return rows.length;
};

// Baja de todos los dispositivos del usuario (lo que usa el toggle de Ajustes).
const deleteAllSubscriptions = async (usuario_id) => {
  const q = `DELETE FROM push_suscripcion WHERE usuario_id = $1 RETURNING id`;
  const { rows } = await pool.query(q, [usuario_id]);
  return rows.length;
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
  updatePushEnabled,
};
