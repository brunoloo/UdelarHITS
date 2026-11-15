// Registro en memoria de conversaciones activas. El límite aplica solo al abrir una
// conversación; las que están en curso siguen. Una conversación deja de contar cuando sus
// participantes la cierran o se desconectan, o tras CHAT_ACTIVE_TTL_MS sin actividad.

const activas = new Map(); // convId (string) -> { users: Set<userId>, last: number }

// pg devuelve los BIGSERIAL como string: se normaliza la key.
const keyOf = (convId) => String(convId);

// Lectura perezosa: configurable por entorno y ajustable desde los tests.
const maxConversations = () => Number(process.env.CHAT_MAX_ACTIVE_CONVERSATIONS || 350);
const activeTtlMs = () => Number(process.env.CHAT_ACTIVE_TTL_MS || 10 * 60 * 1000);

const sweep = (now = Date.now()) => {
  const ttl = activeTtlMs();
  for (const [id, entry] of activas) {
    if (now - entry.last > ttl) activas.delete(id);
  }
};

// Reabrir una conversación en curso nunca se bloquea.
export const tryOpenConversation = (convId, userId) => {
  sweep();
  const key = keyOf(convId);
  const entry = activas.get(key);
  if (entry) {
    entry.users.add(userId);
    entry.last = Date.now();
    return true;
  }
  if (activas.size >= maxConversations()) return false;
  activas.set(key, { users: new Set([userId]), last: Date.now() });
  return true;
};

export const touchConversation = (convId, userId = null) => {
  const key = keyOf(convId);
  const entry = activas.get(key);
  if (entry) {
    entry.last = Date.now();
    if (userId != null) entry.users.add(userId);
  } else {
    activas.set(key, { users: new Set(userId != null ? [userId] : []), last: Date.now() });
  }
};

// La conversación libera su lugar cuando no le quedan participantes.
export const releaseConversation = (convId, userId = null) => {
  const key = keyOf(convId);
  const entry = activas.get(key);
  if (!entry) return;
  if (userId == null) {
    activas.delete(key);
    return;
  }
  entry.users.delete(userId);
  if (entry.users.size === 0) activas.delete(key);
};

export const releaseUserConversations = (userId) => {
  for (const [id, entry] of activas) {
    if (entry.users.delete(userId) && entry.users.size === 0) activas.delete(id);
  }
};

export const getActiveConversationCount = () => {
  sweep();
  return activas.size;
};

// Solo para tests.
export const _resetChatLoad = () => activas.clear();
