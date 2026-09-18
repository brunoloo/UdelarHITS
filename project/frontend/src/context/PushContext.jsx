import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { apiGet, apiPatch } from '../api/client'
import {
  isPushSupported, syncSubscription, disableSubscription, ensureRegistration,
} from '../utils/push'

const PushContext = createContext(null)

export function PushProvider({ children }) {
  const { user, setUser } = useAuth()
  const [supported] = useState(() => isPushSupported())
  // ¿El server tiene claves VAPID? null mientras no se sabe todavía.
  const [configured, setConfigured] = useState(null)
  // El estado REAL: hay suscripción viva en este navegador Y el usuario no lo
  // apagó del lado del server. La columna push_activado sola mentiría (viene en
  // true por default aunque nunca se haya suscrito ningún dispositivo).
  const [enabled, setEnabled] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user || !supported) {
      setEnabled(false)
      return
    }

    let cancelled = false

    ;(async () => {
      try {
        const res = await apiGet('/notifications/push/vapid-key')
        if (cancelled) return
        const publicKey = res?.data?.publicKey || null
        setConfigured(Boolean(publicKey))
        if (!publicKey) return

        // NUNCA pedir permiso acá: fuera de un gesto del usuario iOS ignora el
        // prompt en silencio y quema la oportunidad. Si el permiso no está
        // concedido, o el usuario apagó el toggle, no se toca nada — sólo se
        // refleja el estado.
        if (Notification.permission !== 'granted' || user.push_activado === false) {
          setEnabled(false)
          return
        }

        // Permiso concedido y push activado: re-sincronizar. El upsert por
        // endpoint re-vincula el dispositivo tras reinstalar la PWA o cambiar
        // de cuenta, sin pedirle nada al usuario.
        const ok = await syncSubscription()
        if (!cancelled) setEnabled(ok)
      } catch {
        if (!cancelled) setEnabled(false)
      }
    })()

    return () => { cancelled = true }
  }, [user, supported])

  // Prender. El caller DEBE haber pedido el permiso dentro del gesto del click
  // (ver SettingsPage): acá ya no queda cadena de gesto viva.
  const enablePush = useCallback(async () => {
    setBusy(true)
    try {
      await ensureRegistration()
      const ok = await syncSubscription()
      if (!ok) return false
      await apiPatch('/notifications/push/enabled', { activado: true })
      setUser(prev => (prev ? { ...prev, push_activado: true } : prev))
      setEnabled(true)
      return true
    } catch {
      return false
    } finally {
      setBusy(false)
    }
  }, [setUser])

  const disablePush = useCallback(async () => {
    setBusy(true)
    try {
      await disableSubscription()
      await apiPatch('/notifications/push/enabled', { activado: false })
      setUser(prev => (prev ? { ...prev, push_activado: false } : prev))
      setEnabled(false)
      return true
    } catch {
      return false
    } finally {
      setBusy(false)
    }
  }, [setUser])

  return (
    <PushContext.Provider value={{ supported, configured, enabled, busy, enablePush, disablePush }}>
      {children}
    </PushContext.Provider>
  )
}

export function usePush() {
  return useContext(PushContext) || {
    supported: false, configured: false, enabled: false, busy: false,
    enablePush: async () => false, disablePush: async () => false,
  }
}
