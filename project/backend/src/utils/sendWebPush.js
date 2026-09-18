// Envío de notificaciones push (Web Push / VAPID) al service worker del browser.
//
// Mismo patrón que checkImageSafety.js: módulo aislado (así los tests lo pueden
// mockear con jest.unstable_mockModule) y degradación silenciosa — si las claves
// VAPID no están o el push service falla, NUNCA se rompe el flujo que originó la
// notificación. La notificación in-app ya quedó persistida; el push es un extra.
//
// El punto delicado es el ROLLBACK. createNotification recibe un `client`
// transaccional en varios call-sites (reaction.repository dentro de BEGIN/COMMIT
// con advisory lock, moderation.service ×3): un push disparado inline podría
// anunciar una sanción que después se revierte. Por eso este módulo NUNCA recibe
// la notificación por parámetro ni toca el `client`: re-consulta la fila por id
// con el `pool`, ya fuera de la transacción. Si la fila no existe, hubo rollback
// y no se manda nada.
//
// setImmediate no sirve para eso: correría antes del COMMIT y con READ COMMITTED
// no vería la fila. De ahí los dos intentos temporizados de abajo.

import webpush from 'web-push';
import pool from '../config/db.js';

// Primer intento: margen para que el COMMIT de la transacción que creó la
// notificación ya haya terminado.
const FIRST_ATTEMPT_DELAY_MS = 1500;
// Reintento (a ~6000 ms del alta) para transacciones largas. Si en el segundo
// intento la fila sigue sin existir, se asume rollback y se abandona.
const RETRY_DELAY_MS = 4500;

// Límite de payload de Safari/APNs: ~4 KB. Truncamos el cuerpo bien por debajo.
const MAX_BODY_CHARS = 120;
// Un día: si el dispositivo estuvo apagado más que esto, la notificación ya no
// aporta nada (el usuario la ve igual in-app al abrir la app).
const PUSH_TTL_SECONDS = 86400;

// setVapidDetails es LAZY a propósito: llamarlo al importar el módulo, sin
// claves configuradas, tira y se lleva puesto el boot del server.
let vapidReady = false;

export const isPushConfigured = () => Boolean(
  process.env.VAPID_PUBLIC_KEY &&
  process.env.VAPID_PRIVATE_KEY &&
  process.env.VAPID_SUBJECT
);

// La clave pública se sirve por endpoint (no por VITE_*) para que el front no
// necesite un rebuild si alguna vez cambia.
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

// Agenda el envío. SÍNCRONA y a prueba de balas: es lo único que llama el
// repositorio, dentro de un flujo que no puede fallar por culpa del push.
export const schedulePushForNotification = (notifId) => {
  // Nunca pegarle a FCM/APNs desde los tests, aunque unas claves VAPID se hayan
  // filtrado al entorno (mismo cortocircuito que checkImageSafety y sendEmail).
  // Además evita dejar timers vivos que Jest reportaría como handles abiertos.
  if (process.env.NODE_ENV === 'test') return;
  if (!notifId || !isPushConfigured()) return;

  try {
    // unref(): un push pendiente no debe mantener vivo el proceso ni retrasar
    // el shutdown del server.
    setTimeout(() => { sendPushToUser(notifId, 1); }, FIRST_ATTEMPT_DELAY_MS).unref();
  } catch (err) {
    console.warn(`[push] no se pudo agendar el envío de la notificación ${notifId}: ${err.message}`);
  }
};

// Trae la notificación + la preferencia del destinatario. SIEMPRE con `pool`,
// nunca con el client transaccional: es justamente lo que permite detectar el
// rollback (si la transacción se revirtió, esta consulta no ve nada).
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

// Envía la notificación `notifId` a todos los dispositivos del destinatario.
// `attempt` distingue el primer intento del reintento post-rollback.
// try/catch global: esto corre suelto en un timer, una excepción acá sería un
// unhandled rejection.
export const sendPushToUser = async (notifId, attempt = 1) => {
  try {
    const notif = await fetchNotification(notifId);

    if (!notif) {
      // Todavía puede ser una transacción lenta que no commiteó. Un reintento;
      // si tampoco está, fue ROLLBACK y se abandona en silencio (no anunciamos
      // una sanción que se revirtió).
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
      // Título fijo y el mensaje como cuerpo. La línea "from UdelarHITS" (o el
      // dominio) que se ve en algunos dispositivos NO sale de acá: la agrega el
      // sistema operativo o el navegador para que ningún sitio pueda hacerse
      // pasar por otro, y la API de notificaciones no permite ocultarla.
      title: 'UdelarHITS',
      body: String(notif.mensaje || '').slice(0, MAX_BODY_CHARS),
      // Sin url no hay destino concreto: el panel de notificaciones vive en la
      // home (no hay ruta /notifications propia en el router del SPA).
      url: notif.url || '/',
      notifId: notif.id,
      // El tag deduplica en el SO: una notificación nueva del mismo tipo
      // reemplaza a la anterior en vez de apilarse.
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
        // Suscripción caducada (PWA desinstalada, datos del sitio borrados):
        // el endpoint no vuelve nunca, la fila se borra.
        await deleteSubscription(subs[i].id).catch(() => {});
      } else {
        // 429/500/503 y cualquier otro son TRANSITORIOS: solo se loguean. Borrar
        // acá desuscribiría a un usuario por una caída momentánea de FCM.
        console.warn(`[push] envío fallido (status ${status ?? 'desconocido'}) a la suscripción ${subs[i].id}: ${err?.message}`);
      }
    }
  } catch (err) {
    console.warn(`[push] no se pudo enviar la notificación ${notifId}: ${err.message}`);
  }
};
