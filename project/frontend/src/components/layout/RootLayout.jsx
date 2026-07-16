import { useEffect, useRef } from 'react'
import { Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { trackPageView, trackLogin } from '../../utils/analytics'

// Layout raíz sin path: envuelve TODAS las rutas para poder registrar el
// page_view de GA4 en cada cambio de navegación de React Router (SPA).
export function RootLayout() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const googleLoginHandled = useRef(false)

  // Un page_view por cada cambio de ruta (pathname o querystring).
  useEffect(() => {
    trackPageView(location.pathname + location.search)
  }, [location.pathname, location.search])

  // El login con Google es un flujo de redirect del backend: para usuarios
  // existentes vuelve a `/?login=google`. Registramos el evento y limpiamos el
  // parámetro para que no quede en la URL ni cuente dos veces.
  useEffect(() => {
    if (searchParams.get('login') === 'google' && !googleLoginHandled.current) {
      googleLoginHandled.current = true
      trackLogin('google')
      searchParams.delete('login')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  return <Outlet />
}
