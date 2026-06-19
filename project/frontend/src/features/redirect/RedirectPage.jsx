import { useSearchParams, useNavigate } from 'react-router-dom'
import './redirect.css'

export function RedirectPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const encodedUrl = params.get('to')

  let destinationUrl = null
  try {
    destinationUrl = encodedUrl ? decodeURIComponent(encodedUrl) : null
  } catch {
    destinationUrl = null
  }

  const isValid = destinationUrl &&
    (destinationUrl.startsWith('https://') || destinationUrl.startsWith('http://'))

  let domain = null
  if (isValid) {
    try { domain = new URL(destinationUrl).hostname } catch { /* skip */ }
  }

  function handleBack() {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="redirect-page">
      <div className="redirect-card">

        <div className="redirect-icon">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>

        <h1>Estás saliendo de UdelarHITS</h1>
        <p className="subtitle">Estás a punto de acceder a un sitio externo.</p>

        <div className="destination-block">
          <div className="destination-label">Destino</div>
          <div className={`url-box${isValid ? '' : ' url-box--invalid'}`}>
            {isValid ? destinationUrl : 'Enlace inválido o no permitido.'}
          </div>
          {isValid && domain && (
            <div className="destination-hint">
              Si no esperabas ir a "{domain}", no continúes.
            </div>
          )}
        </div>

        <div className="warning-box">
          <p>Los enlaces externos pueden llevarte a sitios con contenido engañoso, malware o phishing. No verificamos ni controlamos el contenido de sitios de terceros.</p>
          <p>Si este no era el sitio que esperabas abrir, o no reconocés la dirección, lo más seguro es no continuar.</p>
        </div>

        <p className="disclaimer">UdelarHITS no se hace responsable del contenido, la privacidad ni la seguridad de sitios externos.</p>

        <div className="redirect-actions">
          {isValid && (
            <a href={destinationUrl} className="btn-continuar">
              Continuar al enlace
            </a>
          )}
          <button type="button" className="btn-volver" onClick={handleBack}>
            Regresar
          </button>
        </div>

      </div>
    </div>
  )
}
