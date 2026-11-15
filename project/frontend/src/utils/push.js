import { apiGet, apiPost } from '../api/client'

// API del navegador, no datos de UI: usa el cliente HTTP directo. Todo degrada en silencio
// si no hay soporte, permiso o claves.

const SW_URL = '/sw.js'

// En iOS, PushManager solo existe si el sitio está agregado a la pantalla de inicio.
export function isPushSupported() {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  )
}

// Resuelve una sola vez: algunos navegadores llaman al callback y además resuelven la promesa.
// Debe llamarse dentro del clic, mientras el gesto del usuario sigue vigente.
export function requestPushPermission() {
  return new Promise(resolve => {
    const result = Notification.requestPermission(resolve)
    if (result && typeof result.then === 'function') result.then(resolve)
  })
}

// La clave pública llega como base64url y PushManager la necesita como Uint8Array.
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i)
  return output
}

// Espera a que el worker esté activo: subscribe falla si todavía se está instalando.
export async function ensureRegistration() {
  if (!isPushSupported()) return null
  try {
    const existing = await navigator.serviceWorker.getRegistration(SW_URL)
    if (!existing) await navigator.serviceWorker.register(SW_URL)
    return await navigator.serviceWorker.ready
  } catch (err) {
    console.error('[push] No se pudo registrar el service worker:', err)
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

// Si ya hay una suscripción local se vuelve a enviar: el upsert revincula el dispositivo.
// Devuelve true si quedó una suscripción.
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
    if (!publicKey) return false // Servidor sin claves: push desactivado

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
    await saveSubscription(subscription)
    return true
  } catch (err) {
    // Algunos navegadores rechazan acá mientras el push no esté habilitado en su configuración.
    console.error('[push] No se pudo crear la suscripción:', err)
    return false
  }
}

// Sin llamar a subscription.unsubscribe(): en iOS impediría volver a suscribirse sin un gesto nuevo.
export async function disableSubscription() {
  try {
    await apiPost('/notifications/push/unsubscribe', {})
    return true
  } catch {
    return false
  }
}

// push_activado solo no alcanza: es true por defecto.
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
