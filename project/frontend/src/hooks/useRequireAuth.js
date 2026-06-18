import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from './useToast'

/**
 * Returns a guard function for create/submit actions. If the user is not
 * authenticated, it shows a contextual toast, redirects to /login, and
 * returns false so the caller can abort the submit. Buttons/forms stay
 * visible and interactive for guests — the bounce only happens on submit.
 */
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
