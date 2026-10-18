import { useEffect, useState } from 'react'
import { resolveSeason } from '../config/seasons'
import { SeasonContext } from './seasonCtx'

// sessionStorage puede tirar solo con accederlo (storage bloqueado); en ese
// caso seguimos sin override persistido.
function getSessionStorage() {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

export function SeasonProvider({ children }) {
  // Se calcula una vez al montar: si la temporada empieza/termina con la
  // pestaña abierta, se aplica en la próxima carga.
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
