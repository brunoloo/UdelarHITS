import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { SocketContext } from './socketCtx'

export function SocketProvider({ children }) {
  const { user } = useAuth()
  const [socket, setSocket] = useState(null)

  useEffect(() => {
    if (!user) return
    let s = null
    let cancelled = false
    import('socket.io-client').then(({ io }) => {
      if (cancelled) return
      s = io({ withCredentials: true })
      setSocket(s)
    })
    return () => {
      cancelled = true
      if (s) s.disconnect()
    }
  }, [user])

  return (
    <SocketContext.Provider value={user ? socket : null}>
      {children}
    </SocketContext.Provider>
  )
}
