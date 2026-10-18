import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/reset.css'
import './styles/global.css'
import './styles/responsive.css'
import App from './App.jsx'
import { initAnalytics } from './utils/analytics'
import { preventPinchZoom } from './utils/preventZoom'

// Carga condicional de GA4: no-op en desarrollo y sin Measurement ID.
initAnalytics()
preventPinchZoom()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
