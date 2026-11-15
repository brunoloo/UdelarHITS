// Único punto de contacto con gtag(). En desarrollo no se envía nada: exige el
// Measurement ID y un build de producción.

const GA_ID = import.meta.env.VITE_GA4_ID
const ENABLED = Boolean(GA_ID) && import.meta.env.PROD

// Idempotente. dataLayer y gtag() se definen de inmediato para encolar eventos; el script
// se inyecta después de window.load para no competir con el render inicial.
export function initAnalytics() {
  if (!ENABLED || typeof window === 'undefined') return
  if (window.__ga4Initialized) return
  window.__ga4Initialized = true

  window.dataLayer = window.dataLayer || []
  // function y no arrow: gtag espera el objeto `arguments`.
  function gtag() { window.dataLayer.push(arguments) }
  window.gtag = gtag

  gtag('js', new Date())
  // El page_view se envía en cada cambio de ruta, no desde gtag.
  gtag('config', GA_ID, { send_page_view: false })

  function loadScript() {
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`
    document.head.appendChild(script)
  }

  if (document.readyState === 'complete') {
    loadScript()
  } else {
    window.addEventListener('load', () => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(loadScript)
      } else {
        setTimeout(loadScript, 0)
      }
    })
  }
}

function track(eventName, params) {
  if (!ENABLED || typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', eventName, params || {})
}

// El page_view debe llevar el título real de la ruta, que en las vistas de detalle se conoce
// recién al resolver su fetch. Se envía uno solo por navegación: beginPageView (RootLayout)
// abre el ciclo, reportPageView (useDocumentTitle) aporta el título y un fallback garantiza el envío.

const PAGEVIEW_FALLBACK_MS = 4000

let currentPath = null      // ruta de la navegación en curso
let flushedPath = null      // última ruta ya enviada (evita duplicados)
let lastReport = { path: null, title: null } // último título reportado por una vista
let fallbackTimer = null

function clearFallback() {
  if (fallbackTimer != null) {
    clearTimeout(fallbackTimer)
    fallbackTimer = null
  }
}

// Envía el page_view una única vez por ruta (dedupe por `flushedPath`).
function flushPageView(path, title) {
  if (flushedPath === path) return
  flushedPath = path
  clearFallback()
  trackPageView(path, title)
}

// Los efectos de los hijos corren antes que los del padre: el título puede haber llegado primero.
export function beginPageView(path) {
  currentPath = path
  clearFallback()
  if (lastReport.path === path) {
    flushPageView(path, lastReport.title)
    return
  }
  if (typeof window !== 'undefined') {
    fallbackTimer = setTimeout(() => flushPageView(path, document.title), PAGEVIEW_FALLBACK_MS)
  }
}

// Se guarda siempre, por si llega antes que beginPageView.
export function reportPageView(path, title) {
  lastReport = { path, title }
  if (path === currentPath) flushPageView(path, title)
}

// Solo para tests: reinicia el estado de coordinación del page_view.
export function __resetPageViewState() {
  currentPath = null
  flushedPath = null
  lastReport = { path: null, title: null }
  clearFallback()
}

export function trackPageView(path, title) {
  track('page_view', {
    page_path: path,
    page_location: window.location.href,
    page_title: title || document.title,
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
