import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/reset.css'
import './styles/global.css'
import './styles/responsive.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// GA4 fuera de la ruta crítica: se inicializa DESPUÉS del primer render, en
// tiempo ocioso, con import() dinámico. Así la inyección del <script> de gtag
// no compite con el arranque síncrono de React (antes initAnalytics() corría
// antes de createRoot, en la ruta crítica del LCP). track() en analytics.js
// hace self-init idempotente, así que ningún evento disparado antes de este
// idle-callback se pierde (p. ej. el primer page_view). No-op en dev / sin ID.
const bootAnalytics = () =>
  import('./utils/analytics').then(m => m.initAnalytics()).catch(() => {})
if ('requestIdleCallback' in window) {
  requestIdleCallback(bootAnalytics)
} else {
  setTimeout(bootAnalytics, 1)
}
