import { useContext } from 'react'
import { PushContext } from '../context/pushCtx'

export function usePush() {
  return useContext(PushContext) || {
    supported: false, configured: false, enabled: false, busy: false,
    enablePush: async () => false, disablePush: async () => false,
  }
}
