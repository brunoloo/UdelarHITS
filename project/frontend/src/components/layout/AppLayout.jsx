import { Suspense } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Header } from './Header'
import { LeftNav } from './LeftNav'
import { BottomNav } from './BottomNav'
import { MobileDrawer } from './MobileDrawer'
import { Sidebar } from './Sidebar'
import { ScrollToTop } from './ScrollToTop'
import { SeasonalDecor } from '../seasonal/SeasonalDecor'
import { Skeleton } from '../ui/Skeleton'
import { useTrackNavOrigin } from '../../hooks/useBackToHome'
import './AppLayout.css'

export function AppLayout() {
  const { user, loading } = useAuth()
  useTrackNavOrigin()

  if (!loading && user && user.nickname_confirmado === false) {
    return <Navigate to="/setup-profile" replace />
  }

  return (
    <>
      <SeasonalDecor />
      <ScrollToTop />
      <Header />
      <LeftNav />
      <div className="page">
        <main>
          {/* El shell queda visible mientras se descarga el chunk de la página. */}
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
