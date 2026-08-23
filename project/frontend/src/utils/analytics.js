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
//
// dataLayer y gtag() se definen de inmediato (costo cero: solo un array y una
// función). Así los eventos disparados antes de que cargue el script se encolan
// en dataLayer y gtag.js los procesa al arrancar — no se pierden pageviews.
// El <script> pesado (163 KiB) se inyecta recién después de window.load +
// requestIdleCallback para no competir con React por el hilo principal durante
// el render inicial (LCP).
export function initAnalytics() {
  if (!ENABLED || typeof window === 'undefined') return
  if (window.__ga4Initialized) return
  window.__ga4Initialized = true

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

// Envío genérico de eventos. Todas las funciones de abajo pasan por acá. No-op
// si el tracking está deshabilitado o gtag todavía no cargó.
function track(eventName, params) {
  if (!ENABLED || typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', eventName, params || {})
}

// ─── Eventos ────────────────────────────────────────────────────────────────
// Un evento nuevo = una función más acá + una llamada en el handler.

// ─── page_view en la SPA ──────────────────────────────────────────────────
//
// El page_view debe llevar el `page_title` REAL de la ruta, pero en la SPA el
// título de las vistas de detalle se fija recién cuando resuelve su fetch
// (react-query), bastante después del cambio de ruta. Si mandáramos el hit
// apenas cambia la URL (como antes), GA agruparía la navegación interna bajo el
// título viejo/genérico. Por eso el envío se coordina entre dos señales:
//
//   · beginPageView(path)      — lo llama RootLayout en cada navegación.
//   · reportPageView(path, t)  — lo llama useDocumentTitle cuando la vista ya
//                                fijó su título definitivo.
//
// Se envía UN solo page_view por navegación, con el título ya resuelto. Un
// fallback garantiza el hit aunque ninguna vista reporte (ruta sin
// useDocumentTitle) o el fetch nunca resuelva.

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

// RootLayout: arranca el ciclo de una navegación. Si la vista ya reportó su
// título (los efectos de los hijos corren antes que los del padre, así que el
// reporte puede llegar primero), envía de una; si no, arma el fallback.
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

// useDocumentTitle: la vista fijó su título definitivo para `path`. Se guarda
// siempre (por si llega antes que beginPageView) y se envía si ya es la ruta en
// curso.
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

// Envío del hit. `path` = pathname + search; `title` es el título ya resuelto
// (cae a document.title si no se pasa, p. ej. desde el fallback).
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
