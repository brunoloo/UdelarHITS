import { Suspense } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Header } from './Header'
import { LeftNav } from './LeftNav'
import { BottomNav } from './BottomNav'
import { MobileDrawer } from './MobileDrawer'
import { Sidebar } from './Sidebar'
import { ScrollToTop } from './ScrollToTop'
import { Skeleton } from '../ui/Skeleton'
import './AppLayout.css'

export function AppLayout() {
  const { user, loading } = useAuth()

  if (!loading && user && user.nickname_confirmado === false) {
    return <Navigate to="/setup-profile" replace />
  }

  return (
    <>
      <ScrollToTop />
      <Header />
      <LeftNav />
      <div className="page">
        <main>
          {/* Las rutas se cargan con React.lazy (code splitting): el shell
              (header/nav/sidebar) queda visible y solo el contenido muestra un
              skeleton mientras baja el chunk de la página. */}
          <Suspense fallback={<Skeleton height={320} borderRadius={12} style={{ margin: '16px 0' }} />}>
            <Outlet />
          </Suspense>
        </main>
        <Sidebar />
      </div>
      <BottomNav />
      <MobileDrawer />
    </>
  )
}
