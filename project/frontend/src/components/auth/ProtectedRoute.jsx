import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

const ROUTE_LABELS = {
  '/chat': 'al chat',
  '/settings': 'a la configuración',
}

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()

  if (loading) return <div />
  if (!user) {
    const base = Object.keys(ROUTE_LABELS).find(k => pathname.startsWith(k))
    const label = base ? ROUTE_LABELS[base] : null
    return <Navigate to="/login" replace state={{ authMessage: label }} />
  }
  return children
}
