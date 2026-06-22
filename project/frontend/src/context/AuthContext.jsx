import { createContext, useContext, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '../api/client'

const AuthContext = createContext(null)

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
    // Drop any cached data from a previous session so per-user fields (e.g.
    // mi_reaccion) aren't shown for the newly logged-in user.
    queryClient.clear()
    setUser(res.data.user)
    return res
  }

  async function register(data) {
    const res = await apiPost('/auth/register', data)
    return res
  }

  async function logout() {
    await apiPost('/auth/logout')
    queryClient.clear()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
