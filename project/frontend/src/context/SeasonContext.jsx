import { useEffect, useState } from 'react'
import { resolveSeason } from '../config/seasons'
import { SeasonContext } from './seasonCtx'

// sessionStorage puede lanzar con solo accederlo.
function getSessionStorage() {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function SeasonProvider({ children }) {
  // Se calcula una vez al montar.
  const [season] = useState(() =>
    resolveSeason({
      date: new Date(),
      search: window.location.search,
      storage: getSessionStorage(),
    })
  )

  // data-season en <html> para que el CSS pueda engancharse si hace falta.
  useEffect(() => {
    const root = document.documentElement
    if (season) root.dataset.season = season
    else delete root.dataset.season
    return () => {
      delete root.dataset.season
    }
  }, [season])

  return (
    <SeasonContext.Provider value={season}>
      {children}
    </SeasonContext.Provider>
  )
}
