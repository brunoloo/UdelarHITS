import { useContext } from 'react'
import { SocketContext } from '../context/socketCtx'

export function useSocket() {
  return useContext(SocketContext)
}
