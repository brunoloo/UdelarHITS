import {
  upsertSubscription, deleteSubscriptionByEndpoint,
  deleteAllSubscriptions, updatePushEnabled,
  countSubscriptions, subscriptionExists,
} from '../repositories/push.repository.js';
import { getVapidPublicKey } from '../utils/sendWebPush.js';

// Igual que el ancho de la columna: evita un 500 al insertar.
const MAX_ENDPOINT_LENGTH = 500;
// Solo diagnóstico: se recorta en vez de rechazar la suscripción.
const MAX_USER_AGENT_LENGTH = 255;
const MAX_SUBSCRIPTIONS_PER_USER = 10;

// El servidor hace POST a este endpoint en cada notificación: solo se aceptan
// los servicios de push de los navegadores, nunca una URL arbitraria.
const PUSH_SERVICE_HOSTS = [
  'fcm.googleapis.com',
  'android.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
];
const PUSH_SERVICE_SUFFIXES = ['.notify.windows.com', '.push.apple.com'];

const isPushServiceEndpoint = (endpoint) => {
  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password) return false;
  if (url.port && url.port !== '443') return false;
  const host = url.hostname.toLowerCase();
  return PUSH_SERVICE_HOSTS.includes(host) ||
    PUSH_SERVICE_SUFFIXES.some((suffix) => host.endsWith(suffix));
};

const badRequest = (message) => {
  const err = new Error(message);
  err.code = 'BAD_REQUEST';
  return err;
};

const subscribePushService = async (usuarioId, { endpoint, keys } = {}, userAgent = null) => {
  if (typeof endpoint !== 'string' || endpoint.trim() === '') {
    throw badRequest('Endpoint inválido');
  }
  if (endpoint.length > MAX_ENDPOINT_LENGTH) {
    throw badRequest('Endpoint demasiado largo');
  }
  if (!isPushServiceEndpoint(endpoint)) {
    throw badRequest('Endpoint inválido');
  }

  const p256dh = keys?.p256dh;
  const auth = keys?.auth;
  if (typeof p256dh !== 'string' || p256dh.trim() === '' ||
      typeof auth !== 'string' || auth.trim() === '') {
    throw badRequest('Claves de suscripción inválidas');
  }

  if (!(await subscriptionExists(usuarioId, endpoint)) &&
      (await countSubscriptions(usuarioId)) >= MAX_SUBSCRIPTIONS_PER_USER) {
    throw badRequest('Alcanzaste el máximo de dispositivos con notificaciones');
  }
  await upsertSubscription({
    usuario_id: usuarioId,
    endpoint,
    p256dh,
    auth,
    user_agent: userAgent ? String(userAgent).slice(0, MAX_USER_AGENT_LENGTH) : null,
  });
};

// Sin endpoint se dan de baja todos los dispositivos del usuario.
const unsubscribePushService = async (usuarioId, endpoint) => {
  if (typeof endpoint === 'string' && endpoint.trim() !== '') {
    return deleteSubscriptionByEndpoint(usuarioId, endpoint);
  }
  return deleteAllSubscriptions(usuarioId);
};

// Valor explícito y no un toggle, para que reintentar sea idempotente.
const setPushEnabledService = async (usuarioId, activado) => {
  if (typeof activado !== 'boolean') {
    throw badRequest('El campo activado debe ser booleano');
  }

  const row = await updatePushEnabled(usuarioId, activado);

  // Apagar borra las suscripciones: no deben quedar dispositivos activos.
  if (activado === false) await deleteAllSubscriptions(usuarioId);

  return row;
};

// null si el push no está configurado; el cliente deshabilita el toggle.
const getVapidPublicKeyService = () => getVapidPublicKey();

export {
  subscribePushService,
  unsubscribePushService,
  setPushEnabledService,
  getVapidPublicKeyService,
};
