import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { LeftNav } from './LeftNav'
import './AppLayout.css'

export function AppLayout() {
  return (
    <>
      <Header />
      <LeftNav />
      <div className="page">
        <main>
          <Outlet />
        </main>
      </div>
    </>
  )
}
