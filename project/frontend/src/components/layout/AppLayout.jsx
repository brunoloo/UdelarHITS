import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Header } from './Header'
import { LeftNav } from './LeftNav'
import { Sidebar } from './Sidebar'
import './AppLayout.css'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

export function AppLayout() {
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
    </>
  )
}
