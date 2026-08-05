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
    setUser(res.data.user)
    // El feed usa queryKey FIJA ['categories','feed'] (ya no depende de user.id),
    // así que un cambio de sesión no rearma la query por sí solo: hay que
    // invalidar para que la query ACTIVA (el feed montado) se vuelva a pedir
    // personalizada. invalidateQueries es lo que refetchea queries activas;
    // clear() no lo hace de forma confiable con key fija (destruye la query y el
    // observer montado se queda con la data vieja hasta recargar o vencer el
    // staleTime). La cache anónima previa no es sensible, así que alcanza con
    // invalidar todo (marca stale las inactivas + refetch de las activas).
    queryClient.invalidateQueries()
    return res
  }

  // Paso 1 del registro: solicita el código de verificación al email.
  async function register(data) {
    const res = await apiPost('/auth/register', data)
    return res
  }

  // Paso 2 del registro: confirma el código, crea la cuenta e inicia sesión.
  async function verifyEmail(payload) {
    const res = await apiPost('/auth/verify-email', payload)
    setUser(res.data)
    // Mismo caso que login: es un alta que además inicia sesión. Invalidar para
    // que el feed activo (y todo lo dependiente de identidad) se refetchee.
    queryClient.invalidateQueries()
    return res
  }

  // Reenvía el código a un registro pendiente (solo necesita el email).
  async function resendCode(email) {
    const res = await apiPost('/auth/resend-code', { email })
    return res
  }

  async function logout() {
    await apiPost('/auth/logout')
    setUser(null)
    // Al salir hay que descartar TODO lo que sea del usuario que se va (feed,
    // perfil, notificaciones, unread-count, mensajes): si otra persona entra en
    // el mismo navegador sin recargar, no debe ver nada del anterior.
    //
    // No se usa clear() porque destruiría también el feed montado ANTES de que
    // pueda refetchear, dejándolo con la data personalizada vieja. En su lugar:
    //   1) invalidateQueries → refetch de las queries ACTIVAS con la cookie ya
    //      borrada (el feed vuelve al genérico, el badge de no-leídos se vacía),
    //   2) removeQueries({ type: 'inactive' }) → purga la data cacheada de las
    //      vistas NO montadas del usuario anterior.
    // Entre las dos se descarta todo lo del usuario previo, pero sin cortar el
    // refetch de lo que está en pantalla. El orden importa: invalidar primero
    // (mientras las queries activas existen), después remover las inactivas.
    queryClient.invalidateQueries()
    queryClient.removeQueries({ type: 'inactive' })
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, verifyEmail, resendCode, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
