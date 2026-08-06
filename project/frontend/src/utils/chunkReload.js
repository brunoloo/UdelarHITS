// Recuperación de errores de carga de chunks tras un deploy.
//
// Con code splitting (React.lazy en router.jsx) cada ruta lazy pide un archivo
// con hash en el nombre (ej. ExplorePage-CEWS0kwk.js). Tras un deploy esos
// hashes cambian y los archivos viejos dejan de existir: una pestaña que quedó
// abierta con el index.html anterior pide un chunk que ya da 404 y el import()
// rechaza. Recargar la página baja el index.html nuevo (con los hashes nuevos)
// y arregla la navegación.
//
// Este error llega por dos caminos distintos y hay que cubrir los dos:
//  - el evento nativo de Vite 'vite:preloadError' (ver main.jsx), y
//  - el errorElement de React Router, que captura el rechazo del import() de
//    React.lazy cuando NO pasó por el evento de Vite (ver RouteError.jsx).

const RELOAD_TS_KEY = 'chunkReload:lastReloadTs'
const RELOAD_WINDOW_MS = 10_000

// Mensajes con los que los navegadores reportan un import() dinámico fallido.
// Varían entre motores (Chrome/Firefox/Safari) y entre el fallo del preload y
// el del import en sí, por eso se matchea por subcadena contra varios.
const CHUNK_ERROR_PATTERNS = [
  'Failed to fetch dynamically imported module',
  'Importing a module script failed',
  'Loading chunk',
]

// ¿El error es un fallo de carga de chunk? Acepta un Error, un string o el
// detalle de un evento; cualquier otra cosa devuelve false.
export function isChunkLoadError(error) {
  if (!error) return false
  const message =
    typeof error === 'string'
      ? error
      : (error.message || error.reason?.message || String(error))
  return CHUNK_ERROR_PATTERNS.some((pattern) => message.includes(pattern))
}

// Recarga la página UNA sola vez por ventana de 10 s.
//
// Guard obligatorio en sessionStorage: si el chunk falla por una causa que la
// recarga NO resuelve (un 500 real del servidor de assets, un archivo corrupto),
// sin este límite la página entraría en un bucle infinito de recargas y el
// usuario no podría ni salir. Al haber recargado hace menos de 10 s asumimos que
// la recarga no sirvió y dejamos que el error se muestre en pantalla.
//
// Devuelve true si disparó la recarga, false si el guard la bloqueó.
export function reloadOnceForChunkError() {
  let last = 0
  try {
    last = Number(sessionStorage.getItem(RELOAD_TS_KEY)) || 0
  } catch {
    // sessionStorage puede no estar disponible (algunos modos privados, iframes
    // con storage bloqueado). Sin poder leer el guard, preferimos recargar igual
    // a dejar la app rota; el caso es raro y sin persistencia no hay bucle que
    // persista entre recargas de todas formas.
  }

  if (Date.now() - last < RELOAD_WINDOW_MS) {
    return false
  }

  try {
    sessionStorage.setItem(RELOAD_TS_KEY, String(Date.now()))
  } catch {
    // Ver comentario de arriba: si no se puede persistir, seguimos con la recarga.
  }

  window.location.reload()
  return true
}
