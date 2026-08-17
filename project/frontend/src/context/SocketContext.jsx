import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)

export function SocketProvider({ children }) {
  const { user } = useAuth()
  const [socket, setSocket] = useState(null)

  useEffect(() => {
    if (!user) {
      setSocket(null)
      return
    }
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
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  return useContext(SocketContext)
}
