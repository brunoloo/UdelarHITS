import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { apiGet, apiPatch } from '../api/client'
import {
  isPushSupported, syncSubscription, disableSubscription, ensureRegistration,
} from '../utils/push'
import { PushContext } from './pushCtx'

export function PushProvider({ children }) {
  const { user, setUser } = useAuth()
  const [supported] = useState(() => isPushSupported())
  // null mientras no se sabe si el servidor tiene push configurado.
  const [configured, setConfigured] = useState(null)
  // Estado real: hay una suscripción en este navegador y el usuario no la apagó.
  // push_activado solo no alcanza: es true por defecto.
  const [enabledFor, setEnabledFor] = useState(null)
  const [busy, setBusy] = useState(false)
  const userId = user?.id ?? null
  const enabled = supported && userId !== null && enabledFor === userId

  useEffect(() => {
    if (!user || !supported) return

    let cancelled = false

    ;(async () => {
      try {
        const res = await apiGet('/notifications/push/vapid-key')
        if (cancelled) return
        const publicKey = res?.data?.publicKey || null
        setConfigured(Boolean(publicKey))
        if (!publicKey) return

        // Acá nunca se pide permiso: fuera de un gesto del usuario iOS ignora el pedido.
        if (Notification.permission !== 'granted' || user.push_activado === false) {
          setEnabledFor(null)
          return
        }

        // Con permiso y push activado se vuelve a sincronizar: el upsert revincula el dispositivo.
        const ok = await syncSubscription()
        if (!cancelled) setEnabledFor(ok ? user.id : null)
      } catch {
        if (!cancelled) setEnabledFor(null)
      }
    })()

    return () => { cancelled = true }
  }, [user, supported])

  // El caller debe haber pedido el permiso dentro del gesto del clic (ver SettingsPage).
  const enablePush = useCallback(async () => {
    setBusy(true)
    try {
      await ensureRegistration()
      const ok = await syncSubscription()
      if (!ok) return false
      await apiPatch('/notifications/push/enabled', { activado: true })
      setUser(prev => (prev ? { ...prev, push_activado: true } : prev))
      setEnabledFor(userId)
      return true
    } catch {
      return false
    } finally {
      setBusy(false)
    }
  }, [setUser, userId])

  const disablePush = useCallback(async () => {
    setBusy(true)
    try {
      await disableSubscription()
      await apiPatch('/notifications/push/enabled', { activado: false })
      setUser(prev => (prev ? { ...prev, push_activado: false } : prev))
      setEnabledFor(null)
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
