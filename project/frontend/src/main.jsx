import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/reset.css'
import './styles/global.css'
import './styles/responsive.css'
import App from './App.jsx'
import { initAnalytics } from './utils/analytics'
import { reloadOnceForChunkError } from './utils/chunkReload'

// Recuperación de chunks tras un deploy. Vite dispara 'vite:preloadError' cuando
// falla el modulepreload/import() de un chunk lazy (típicamente un 404 porque el
// deploy cambió los hashes y esta pestaña sigue con el index.html viejo).
// preventDefault() evita que Vite deje propagar el error, y recargamos para bajar
// el index.html nuevo. El guard de 10 s (dentro de reloadOnceForChunkError) evita
// el bucle infinito si la recarga no resuelve el problema.
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault()
  reloadOnceForChunkError()
})

// Carga condicional de GA4: no-op en desarrollo y sin Measurement ID.
initAnalytics()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
