import { createContext } from 'react'

// Valor = id de la temporada activa (ver config/seasons.js) o null. El default
// null es seguro: un componente renderizado fuera del provider (tests, etc.)
// simplemente no ve temporada. Separado del provider para que Fast Refresh no
// se queje (react-refresh/only-export-components).
export const SeasonContext = createContext(null)
