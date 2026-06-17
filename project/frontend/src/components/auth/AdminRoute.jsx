import { Navigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export function AdminRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) return <div />
  if (!user || user.rol !== 'admin') return <Navigate to="/" replace />
  return children
}
