import { useContext } from 'react'
import { ToastContext } from '../context/toastCtx'

export function useToast() {
  return useContext(ToastContext)
}
