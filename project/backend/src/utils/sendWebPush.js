// Módulo aislado y con degradación silenciosa: un fallo del push no afecta al flujo
// que creó la notificación. El envío relee la fila con el pool, fuera de la transacción:
// si no existe, hubo rollback y no se envía. setImmediate no alcanza: correría antes del COMMIT.

import webpush from 'web-push';
import pool from '../config/db.js';

// Margen para que termine el COMMIT de la transacción que creó la notificación.
const FIRST_ATTEMPT_DELAY_MS = 1500;
// Para transacciones largas. Si la fila sigue sin existir, se asume rollback.
const RETRY_DELAY_MS = 4500;

// Límite de payload de ~4 KB: el cuerpo se trunca muy por debajo.
const MAX_BODY_CHARS = 120;
// Un día: después la notificación ya no aporta y se ve igual dentro del sitio.
const PUSH_TTL_SECONDS = 86400;

// Configuración perezosa: hacerlo al importar, sin claves, lanzaría y frenaría el arranque.
let vapidReady = false;

export const isPushConfigured = () => Boolean(
  process.env.VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY &&
  process.env.VAPID_SUBJECT
);

// Se sirve por endpoint y no en el bundle, para no requerir un rebuild si cambia.
export const getVapidPublicKey = () => process.env.VAPID_PUBLIC_KEY || null;

const ensureVapid = () => {
  if (vapidReady) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  vapidReady = true;
};

// Síncrona y sin excepciones: la llama el repositorio dentro de un flujo que no puede
// fallar por el push.
export const schedulePushForNotification = (notifId) => {
  // Nunca se envía desde los tests; además evita timers vivos.
  if (process.env.NODE_ENV === 'test') return;
  if (!notifId || !isPushConfigured()) return;

  try {
    // unref(): un envío pendiente no debe retrasar el cierre del proceso.
    setTimeout(() => { sendPushToUser(notifId, 1); }, FIRST_ATTEMPT_DELAY_MS).unref();
  } catch (err) {
    console.warn(`[push] no se pudo agendar el envío de la notificación ${notifId}: ${err.message}`);
  }
};

// Siempre con el pool: es lo que permite detectar el rollback.
const fetchNotification = async (notifId) => {
  const q = `
    SELECT n.id, n.usuario_id, n.tipo, n.mensaje, n.url, u.push_activado
    FROM notificacion n
    JOIN usuario u ON u.id = n.usuario_id
    WHERE n.id = $1
  `;
  const { rows } = await pool.query(q, [notifId]);
  return rows[0] || null;
};

const getSubscriptions = async (usuarioId) => {
  const { rows } = await pool.query(
    `SELECT id, endpoint, p256dh, auth FROM push_suscripcion WHERE usuario_id = $1`,
    [usuarioId]
  );
  return rows;
};

const deleteSubscription = async (id) => {
  await pool.query(`DELETE FROM push_suscripcion WHERE id = $1`, [id]);
};

// try/catch global: corre en un timer y una excepción sería un unhandled rejection.
export const sendPushToUser = async (notifId, attempt = 1) => {
  try {
    const notif = await fetchNotification(notifId);

    if (!notif) {
      // Puede ser una transacción que aún no hizo COMMIT: un reintento y, si tampoco está, se abandona.
      if (attempt === 1) {
        setTimeout(() => { sendPushToUser(notifId, 2); }, RETRY_DELAY_MS).unref();
      }
      return;
    }

    if (notif.push_activado === false) return;

    const subs = await getSubscriptions(notif.usuario_id);
    if (subs.length === 0) return;

    ensureVapid();

    const payload = JSON.stringify({
      // Título fijo y el mensaje como cuerpo. La línea con el nombre del sitio la agrega el sistema operativo.
      title: 'UdelarHITS',
      body: String(notif.mensaje || '').slice(0, MAX_BODY_CHARS),
      // Sin url el destino es el inicio, donde está el panel de notificaciones.
      url: notif.url || '/',
      notifId: notif.id,
      // El tag hace que una notificación nueva del mismo tipo reemplace a la anterior.
      tag: `notif-${notif.tipo}`,
    });

    const results = await Promise.allSettled(
      subs.map(sub => webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
        { TTL: PUSH_TTL_SECONDS }
      ))
    );

    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'fulfilled') continue;
      const err = results[i].reason;
      const status = err?.statusCode;
      if (status === 404 || status === 410) {
        // Suscripción caducada: se borra.
        await deleteSubscription(subs[i].id).catch(() => {});
      } else {
        // Los demás errores son transitorios: solo se registran, sin dar de baja la suscripción.
        console.warn(`[push] envío fallido (status ${status ?? 'desconocido'}) a la suscripción ${subs[i].id}: ${err?.message}`);
      }
    }
  } catch (err) {
    console.warn(`[push] no se pudo enviar la notificación ${notifId}: ${err.message}`);
  }
};
