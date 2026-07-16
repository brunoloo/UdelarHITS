// Módulo centralizado de analytics (Google Analytics 4 / gtag.js).
//
// Toda interacción con gtag() pasa por acá — ningún componente llama a gtag()
// directamente. Agregar un evento nuevo es tan simple como exportar una función
// más (ver el bloque "Eventos" al final) y llamarla desde el handler donde ya
// ocurre la acción.
//
// En desarrollo NO se envía nada a GA: el gate `ENABLED` exige que exista el
// Measurement ID (VITE_GA4_ID) y que el build sea de producción. Así, aunque
// alguien deje el ID configurado localmente, `import.meta.env.PROD` mantiene el
// tracking apagado fuera de producción.

const GA_ID = import.meta.env.VITE_GA4_ID
const ENABLED = Boolean(GA_ID) && import.meta.env.PROD

// Carga el script de gtag.js una sola vez y arranca la config. Idempotente:
// llamarla más de una vez no reinyecta el script. No-op si el tracking está
// deshabilitado (dev, o sin Measurement ID).
export function initAnalytics() {
  if (!ENABLED || typeof window === 'undefined') return
  if (window.__ga4Initialized) return
  window.__ga4Initialized = true

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
  document.head.appendChild(script)

  window.dataLayer = window.dataLayer || []
  // gtag empuja los argumentos crudos a dataLayer; se define así (function, no
  // arrow) para preservar el objeto `arguments` tal como espera GA.
  function gtag() { window.dataLayer.push(arguments) }
  window.gtag = gtag

  gtag('js', new Date())
  // send_page_view: false — el page_view lo mandamos nosotros en cada cambio de
  // ruta de React Router (ver trackPageView + RootLayout), evitando duplicar el
  // hit inicial que gtag enviaría por su cuenta.
  gtag('config', GA_ID, { send_page_view: false })
}

// Envío genérico de eventos. Todas las funciones de abajo pasan por acá. No-op
// si el tracking está deshabilitado o gtag todavía no cargó.
function track(eventName, params) {
  if (!ENABLED || typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', eventName, params || {})
}

// ─── Eventos ────────────────────────────────────────────────────────────────
// Un evento nuevo = una función más acá + una llamada en el handler.

// page_view manual en cada cambio de ruta (SPA). `path` = pathname + search.
export function trackPageView(path) {
  track('page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  })
}

// method: 'email' | 'google'
export const trackSignUp = (method) => track('sign_up', { method })

// method: 'email' | 'google'
export const trackLogin = (method) => track('login', { method })

export const trackCreateCategory = () => track('create_category')

export const trackCreateTopic = () => track('create_topic')

// commentType: 'direct' (comentario directo a un tema) | 'reply' (respuesta)
export const trackCreateComment = (commentType) => track('create_comment', { comment_type: commentType })

export const trackLike = () => track('like')

export const trackFollowUser = () => track('follow_user')

export const trackSubscribeCategory = () => track('subscribe_category')

// contentType: 'categoria' | 'tema' | 'comentario'
export const trackSaveContent = (contentType) => track('save_content', { content_type: contentType })

export const trackSearch = (term) => track('search', { search_term: term })
