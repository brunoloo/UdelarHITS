import { useEffect } from 'react'
import { useRouteError, useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { isChunkLoadError, reloadOnceForChunkError } from '../../utils/chunkReload'
import './RouteError.css'

// errorElement de las rutas. React Router lo renderiza cuando el render de una
// ruta lanza — incluyendo el rechazo del import() de un chunk lazy que NO pasó
// por el evento 'vite:preloadError' de Vite (este caso concreto lo captura acá
// el router, no el evento).
//
// Dos ramas:
//  - Error de chunk (deploy nuevo, hash viejo 404): recarga la página una vez
//    (con el guard de 10 s) para bajar el index.html nuevo.
//  - Cualquier otro error (ej. red que se cae un segundo en el celular): pantalla
//    de error propia con botón de reintento que resetea las queries y re-renderiza
//    la ruta, sin obligar al usuario a recargar a mano.
export function RouteError() {
  const error = useRouteError()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  const chunkError = isChunkLoadError(error)

  // La recarga es un efecto secundario: se dispara al montar el boundary si el
  // error fue de chunk. El guard de sessionStorage evita el bucle infinito si la
  // recarga no resuelve el problema.
  useEffect(() => {
    if (chunkError) {
      reloadOnceForChunkError()
    }
  }, [chunkError])

  if (chunkError) {
    // Mientras se dispara la recarga (o si el guard la bloqueó tras un intento
    // fallido) mostramos un mensaje neutro en vez de la pantalla de error dura.
    return (
      <div className="route-error" role="status" aria-live="polite">
        <div className="route-error__card">
          <div className="route-error__spinner" aria-hidden="true" />
          <p className="route-error__message">Actualizando la aplicación…</p>
        </div>
      </div>
    )
  }

  function handleRetry() {
    // Limpia el estado de error de las queries cacheadas para que el próximo
    // render las vuelva a pedir desde cero…
    queryClient.resetQueries()
    // …y re-navega a la misma ruta para que React Router reintente el render y
    // salga de este boundary sin una recarga completa de la página.
    navigate(location.pathname + location.search, { replace: true })
  }

  return (
    <div className="route-error" role="alert">
      <div className="route-error__card">
        <svg
          className="route-error__icon"
          xmlns="http://www.w3.org/2000/svg"
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <h1 className="route-error__title">Algo salió mal</h1>
        <p className="route-error__message">
          No pudimos cargar esta sección. Puede ser un problema temporal de conexión.
        </p>
        <button type="button" className="route-error__retry" onClick={handleRetry}>
          Reintentar
        </button>
      </div>
    </div>
  )
}
