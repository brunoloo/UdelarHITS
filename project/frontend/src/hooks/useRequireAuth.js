import { useNavigate } from 'react-router-dom'
import { useAuth } from './useAuth'
import { useToast } from './useToast'

// Devuelve un guard para acciones de crear o enviar: sin sesión avisa, redirige a /login y devuelve false.
export function useRequireAuth() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  return function requireAuth(message) {
    if (user) return true
    showToast(message, 'error')
    navigate('/login')
    return false
  }
}
