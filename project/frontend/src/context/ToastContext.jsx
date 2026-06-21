import { createContext, useContext, useRef, useState } from 'react'

export const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ message: '', type: 'error', visible: false })
  const timerRef = useRef(null)

  function showToast(message, type = 'error') {
    clearTimeout(timerRef.current)
    setToast({ message, type, visible: true })
    timerRef.current = setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }))
    }, 4000)
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className={`toast toast--${toast.type}${toast.visible ? ' is-visible' : ''}`}>
        {toast.message}
      </div>
    </ToastContext.Provider>
  )
}

export function useToastContext() {
  return useContext(ToastContext)
}
