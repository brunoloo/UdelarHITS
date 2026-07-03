import { useEffect } from 'react'
import { Outlet, useLocation, Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { Header } from './Header'
import { LeftNav } from './LeftNav'
import { BottomNav } from './BottomNav'
import { Sidebar } from './Sidebar'
import './AppLayout.css'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

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
          <Outlet />
        </main>
        <Sidebar />
      </div>
      <BottomNav />
    </>
  )
}
