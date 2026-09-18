import { apiGet, apiPost } from '../api/client'

// Lógica de suscripción a notificaciones push. Es API de browser pura (service
// worker + PushManager), no datos de UI, así que habla directo con el cliente
// HTTP en vez de pasar por TanStack Query — mismo criterio que el código de
// sockets.
//
// Todo lo de acá degrada en silencio: si el navegador no soporta push, o el
// usuario negó el permiso, o el server no tiene claves VAPID, la app funciona
// exactamente igual (las notificaciones in-app no dependen de nada de esto).

const SW_URL = '/sw.js'

// En iOS, PushManager solo existe si la PWA está agregada a la pantalla de
// inicio: en una pestaña de Safari da undefined y toda la UI se deshabilita
// sola, que es el comportamiento correcto y no un bug.
export function isPushSupported() {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  )
}

// La clave pública VAPID viaja como base64url y PushManager la quiere como
// Uint8Array cruda.
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i)
  return output
}

// Registra el service worker (o devuelve el ya registrado) y espera a que esté
// activo: pushManager.subscribe falla si el worker todavía está instalando.
export async function ensureRegistration() {
  if (!isPushSupported()) return null
  try {
    const existing = await navigator.serviceWorker.getRegistration(SW_URL)
    if (!existing) await navigator.serviceWorker.register(SW_URL)
    return await navigator.serviceWorker.ready
  } catch {
    return null
  }
}

async function getPublicKey() {
  try {
    const res = await apiGet('/notifications/push/vapid-key')
    return res?.data?.publicKey || null
  } catch {
    return null
  }
}

async function saveSubscription(subscription) {
  const json = subscription.toJSON()
  await apiPost('/notifications/push/subscribe', {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
  })
}

// Deja al navegador y al server de acuerdo. Si ya hay una suscripción local, se
// re-postea igual: el upsert va por endpoint, así que esto es lo que re-vincula
// el dispositivo después de reinstalar la PWA o de entrar con otra cuenta.
// Devuelve true si quedó una suscripción viva.
export async function syncSubscription() {
  if (!isPushSupported()) return false
  try {
    const registration = await ensureRegistration()
    if (!registration) return false

    const existing = await registration.pushManager.getSubscription()
    if (existing) {
      await saveSubscription(existing)
      return true
    }

    const publicKey = await getPublicKey()
    if (!publicKey) return false // server sin claves VAPID: push desactivado

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
    await saveSubscription(subscription)
    return true
  } catch {
    return false
  }
}

// Apaga el push del lado del SERVER, deliberadamente sin llamar a
// subscription.unsubscribe(): en Safari/iOS eso deja al sitio sin poder volver a
// suscribirse hasta un gesto nuevo del usuario, y volver a prender el toggle
// dejaría de funcionar. Borrando la fila del server ya no sale ningún push.
export async function disableSubscription() {
  try {
    await apiPost('/notifications/push/unsubscribe', {})
    return true
  } catch {
    return false
  }
}

// ¿Hay una suscripción viva en ESTE navegador? Lo usa el toggle: la columna
// push_activado sola mentiría (viene en true por default aunque nunca se haya
// suscrito ningún dispositivo).
export async function hasLocalSubscription() {
  if (!isPushSupported()) return false
  try {
    const registration = await navigator.serviceWorker.getRegistration(SW_URL)
    if (!registration) return false
    const existing = await registration.pushManager.getSubscription()
    return Boolean(existing)
  } catch {
    return false
  }
}
