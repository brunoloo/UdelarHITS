// Registro en memoria de conversaciones de chat "activas" (Defensa 1).
//
// Objetivo: acotar cuántas conversaciones simultáneas soporta el servidor sin
// tumbar el resto del sitio. El límite aplica SOLO al abrir una conversación
// (getOrStartConversation): quienes ya estaban chateando siguen sin
// interrupción, y el resto del foro no se ve afectado.
//
// El estado vive en memoria (single-instance, igual que los rate limiters del
// proyecto): se reinicia con el proceso, lo cual es aceptable — en el peor caso
// tras un restart todos los lugares quedan libres.
//
// Una conversación deja de contar como activa cuando:
//  - todos sus participantes la cerraron (deleteConversation) o se
//    desconectaron (socket disconnect), o
//  - no tuvo actividad por CHAT_ACTIVE_TTL_MS (sweep perezoso: se barre en
//    cada operación, sin timers).

const activas = new Map(); // convId (string) -> { users: Set<userId>, last: number }

// pg devuelve los BIGSERIAL como string y los controllers convierten los
// params con Number(): se normaliza la key para que siempre coincidan.
const keyOf = (convId) => String(convId);

// Los límites se leen de forma perezosa para poder configurarlos por env sin
// tocar código (y para que los tests puedan setearlos antes de cada uso).
const maxConversations = () => Number(process.env.CHAT_MAX_ACTIVE_CONVERSATIONS || 350);
const activeTtlMs = () => Number(process.env.CHAT_ACTIVE_TTL_MS || 10 * 60 * 1000);

const sweep = (now = Date.now()) => {
  const ttl = activeTtlMs();
  for (const [id, entry] of activas) {
    if (now - entry.last > ttl) activas.delete(id);
  }
};

// Intenta registrar la apertura de una conversación. Devuelve true si se puede
// abrir (o si ya estaba activa: reabrir una conversación en curso nunca se
// bloquea), false si el servidor está al máximo de conversaciones activas.
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

// Refresca la actividad de una conversación (envío de mensaje). Continuar una
// conversación existente nunca se bloquea, aunque el registro esté al máximo:
// el gate duro es solo la apertura.
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

// Libera la participación de un usuario en una conversación (cierre explícito).
// La conversación libera su lugar cuando no le queda ningún participante.
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

// Libera todas las conversaciones de un usuario (desconexión de socket).
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
