import {
  upsertSubscription, deleteSubscriptionByEndpoint,
  deleteAllSubscriptions, updatePushEnabled,
} from '../repositories/push.repository.js';
import { getVapidPublicKey } from '../utils/sendWebPush.js';

// Igual que la columna `endpoint` del schema; un endpoint más largo no entraría
// y el INSERT reventaría con un 500 en vez de un 400 explicativo.
const MAX_ENDPOINT_LENGTH = 500;
// El user agent es solo diagnóstico: se recorta al ancho de la columna en vez
// de rechazar la suscripción por un header largo.
const MAX_USER_AGENT_LENGTH = 255;

const badRequest = (message) => {
  const err = new Error(message);
  err.code = 'BAD_REQUEST';
  return err;
};

const subscribePushService = async (usuarioId, { endpoint, keys } = {}, userAgent = null) => {
  if (typeof endpoint !== 'string' || endpoint.trim() === '') {
    throw badRequest('Endpoint inválido');
  }
  // Los push services siempre son https; además evita que se guarde cualquier
  // URL arbitraria en la tabla.
  if (!endpoint.startsWith('https://')) {
    throw badRequest('Endpoint inválido');
  }
  if (endpoint.length > MAX_ENDPOINT_LENGTH) {
    throw badRequest('Endpoint demasiado largo');
  }

  const p256dh = keys?.p256dh;
  const auth = keys?.auth;
  if (typeof p256dh !== 'string' || p256dh.trim() === '' ||
      typeof auth !== 'string' || auth.trim() === '') {
    throw badRequest('Claves de suscripción inválidas');
  }

  await upsertSubscription({
    usuario_id: usuarioId,
    endpoint,
    p256dh,
    auth,
    user_agent: userAgent ? String(userAgent).slice(0, MAX_USER_AGENT_LENGTH) : null,
  });
};

// Sin endpoint borra TODAS las suscripciones del usuario: es lo que necesita el
// toggle de Ajustes, que apaga el push en todos los dispositivos, no solo en el
// que está usando en ese momento.
const unsubscribePushService = async (usuarioId, endpoint) => {
  if (typeof endpoint === 'string' && endpoint.trim() !== '') {
    return deleteSubscriptionByEndpoint(usuarioId, endpoint);
  }
  return deleteAllSubscriptions(usuarioId);
};

// Booleano estricto: un endpoint explícito ({ activado }) y no un toggle ciego,
// para que reintentar la misma request sea idempotente.
const setPushEnabledService = async (usuarioId, activado) => {
  if (typeof activado !== 'boolean') {
    throw badRequest('El campo activado debe ser booleano');
  }

  const row = await updatePushEnabled(usuarioId, activado);

  // Apagar significa dejar de recibir YA, no solo marcar la columna: sin borrar
  // las suscripciones quedarían dispositivos vivos esperando a que alguien
  // vuelva a poner la columna en true.
  if (activado === false) await deleteAllSubscriptions(usuarioId);

  return row;
};

// null = push no configurado en el server (sin claves VAPID). El front lo usa
// para deshabilitar el toggle en vez de fallar al suscribirse.
const getVapidPublicKeyService = () => getVapidPublicKey();

export {
  subscribePushService,
  unsubscribePushService,
  setPushEnabledService,
  getVapidPublicKeyService,
};
