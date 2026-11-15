import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '../api/client'
import { AuthContext } from './authCtx'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    apiGet('/users/me')
      .then(res => setUser(res.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  async function login(credentials) {
    const res = await apiPost('/auth/login', credentials)
    setUser(res.data.user)
    // La key del feed es fija: un cambio de sesión no rearma la query. invalidateQueries
    // refetchea las queries activas; clear() dejaría al feed montado con los datos anteriores.
    queryClient.invalidateQueries()
    return res
  }

  async function register(data) {
    const res = await apiPost('/auth/register', data)
    return res
  }

  async function verifyEmail(payload) {
    const res = await apiPost('/auth/verify-email', payload)
    setUser(res.data)
    // Igual que en login: el alta inicia sesión.
    queryClient.invalidateQueries()
    return res
  }

  async function resendCode(email) {
    const res = await apiPost('/auth/resend-code', { email })
    return res
  }

  async function logout() {
    await apiPost('/auth/logout')
    setUser(null)
    // Al salir se descarta todo lo del usuario anterior. Primero invalidateQueries (refetch de lo
    // que está en pantalla, ya sin cookie) y después removeQueries de las inactivas;
    // clear() cortaría ese refetch.
    queryClient.invalidateQueries()
    queryClient.removeQueries({ type: 'inactive' })
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, verifyEmail, resendCode, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
