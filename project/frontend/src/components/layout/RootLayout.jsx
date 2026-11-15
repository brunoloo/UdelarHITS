import { useEffect, useRef, Suspense } from 'react'
import { Outlet, useLocation, useSearchParams } from 'react-router-dom'
import { beginPageView, trackLogin } from '../../utils/analytics'
import { Skeleton } from '../ui/Skeleton'

// Envuelve todas las rutas para registrar el page_view en cada navegación.
export function RootLayout() {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const googleLoginHandled = useRef(false)

  // Acá solo se abre el ciclo; el envío sale con el título que reporta cada vista (ver analytics.js).
  useEffect(() => {
    beginPageView(location.pathname + location.search)
  }, [location.pathname, location.search])

  // El login con Google vuelve a /?login=google: se registra el evento y se limpia el parámetro.
  useEffect(() => {
    if (searchParams.get('login') === 'google' && !googleLoginHandled.current) {
      googleLoginHandled.current = true
      trackLogin('google')
      searchParams.delete('login')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // Suspense para las rutas lazy que no cuelgan de AppLayout.
  return (
    <Suspense fallback={<Skeleton height={320} borderRadius={12} style={{ margin: '24px auto', maxWidth: 720 }} />}>
      <Outlet />
    </Suspense>
  )
}
