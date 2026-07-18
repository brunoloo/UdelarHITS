import { useEffect, useRef, Suspense } from 'react'
import { Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { trackPageView, trackLogin } from '../../utils/analytics'
import { Skeleton } from '../ui/Skeleton'

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

  // Boundary de nivel raíz para las rutas lazy que NO cuelgan de AppLayout
  // (login, register, chat, about, setup, redirect). Las de AppLayout tienen su
  // propio Suspense que preserva el shell.
  return (
    <Suspense fallback={<Skeleton height={320} borderRadius={12} style={{ margin: '24px auto', maxWidth: 720 }} />}>
      <Outlet />
    </Suspense>
  )
}
