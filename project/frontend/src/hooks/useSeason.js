import { useContext } from 'react'
import { SeasonContext } from '../context/seasonCtx'

// Id de la temporada activa ('halloween', ...) o null.
export function useSeason() {
  return useContext(SeasonContext)
}
