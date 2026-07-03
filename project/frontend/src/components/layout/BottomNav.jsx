import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { apiGet } from '../../api/client'

export function BottomNav() {
  const { user } = useAuth()
  const { pathname } = useLocation()

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => apiGet('/notifications/unread-count').then(r => r.data?.total ?? 0),
    enabled: !!user,
    refetchInterval: 60000,
  })

  function navClass(path) {
    const active = path === '/' ? pathname === '/' : pathname.startsWith(path)
    return `bottom-nav-item${active ? ' active' : ''}`
  }

  return (
    <nav className="bottom-nav">
      <Link to="/" className={navClass('/')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3 11 9-8 9 8" />
          <path d="M5 10v10h14V10" />
        </svg>
        <span>Inicio</span>
      </Link>

      <Link to="/explore" className={navClass('/explore')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <span>Explorar</span>
      </Link>

      <button
        className="bottom-nav-item"
        onClick={() => window.dispatchEvent(new CustomEvent('toggle-notif-panel'))}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
          <path d="M10 21a2 2 0 0 0 4 0" />
        </svg>
        {user && unreadCount > 0 && (
          <div className="bottom-nav-badge">{unreadCount > 9 ? '+9' : unreadCount}</div>
        )}
        <span>Alertas</span>
      </button>

      <Link to="/chat" className={navClass('/chat')}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span>Chat</span>
      </Link>

      {user ? (
        <Link to={`/user/${user.nickname}`} className={navClass(`/user/${user.nickname}`)}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          <span>Perfil</span>
        </Link>
      ) : (
        <Link to="/login" className={navClass('/login')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
          <span>Login</span>
        </Link>
      )}
    </nav>
  )
}
