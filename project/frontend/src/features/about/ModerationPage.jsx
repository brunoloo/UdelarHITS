import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AboutMobileBack } from './AboutMobileBack'
import './about.css'

export function ModerationPage() {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  return (
    <>
    <AboutMobileBack />
    <div className="about-page-wrap">
    <div className="about-container">
      <div className="about-page-header">
        <Link to="/about" className="about-breadcrumb">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          Acerca de UdelarHITS
        </Link>
        <h1>Moderación y reportes</h1>
        <p>UdelarHITS funciona mediante un modelo de moderación comunitaria. No contamos con un equipo editorial que censure proactivamente; es la propia comunidad la que cuenta con herramientas para auditar y señalar el contenido que vulnera las normas.</p>
      </div>

      <div className="about-section">
        <h2>Principio de moderación</h2>
        <p>Los administradores de la plataforma <strong>no ejercen poder editorial arbitrario</strong> sobre el contenido individual. El mecanismo principal de control es el sistema de reportes colectivos, garantizando que el ocultamiento de contenido responda al consenso de la comunidad y no a decisiones unilaterales injustificadas.</p>
      </div>

      <hr className="about-divider" />

      <div className="about-section">
        <h2>Cómo funciona el sistema de reportes</h2>
        <div className="about-flow">
          <div className="about-flow-step">
            <div className="about-flow-step-num">1</div>
            <div className="about-flow-step-body">
              <strong>Un usuario reporta el contenido</strong>
              <p>Cualquier usuario registrado puede reportar un comentario, tema o categoría indicando el motivo de la infracción.</p>
            </div>
          </div>
          <div className="about-flow-step">
            <div className="about-flow-step-num">2</div>
            <div className="about-flow-step-body">
              <strong>Los reportes se acumulan de forma segura</strong>
              <p>Un solo reporte no tiene efecto inmediato. El sistema audita y contabiliza la cantidad de usuarios independientes que han señalado el mismo contenido, evitando el abuso del sistema.</p>
            </div>
          </div>
          <div className="about-flow-step">
            <div className="about-flow-step-num">3</div>
            <div className="about-flow-step-body">
              <strong>Umbral alcanzado → Ocultamiento preventivo</strong>
              <p>Cuando el volumen de reportes alcanza el umbral de seguridad definido, el contenido se oculta de la vista pública de manera automática para proteger a la comunidad.</p>
            </div>
          </div>
          <div className="about-flow-step">
            <div className="about-flow-step-num">4</div>
            <div className="about-flow-step-body">
              <strong>Derecho a réplica (Apelación)</strong>
              <p>El autor original es notificado y puede iniciar una apelación si considera que el ocultamiento fue injusto. La administración revisa el caso con base en las reglas y emite un fallo definitivo.</p>
            </div>
          </div>
        </div>
      </div>

      <hr className="about-divider" />

      <div className="about-section">
        <h2>Motivos de reporte válidos</h2>
        <p>El sistema de reportes debe usarse con responsabilidad. No existe un motivo para "estoy en desacuerdo". Los motivos válidos son:</p>
        <div className="about-flow" style={{ marginTop: 16 }}>
          <div className="about-flow-step">
            <div className="about-flow-step-num">1</div>
            <div className="about-flow-step-body">
              <p><strong>Incitación al odio o Acoso.</strong> Promoción de discriminación, violencia o ataques personales directos contra individuos o grupos.</p>
            </div>
          </div>
          <div className="about-flow-step">
            <div className="about-flow-step-num">2</div>
            <div className="about-flow-step-body">
              <p><strong>Spam / Publicidad.</strong> Contenido masivo, bots, promociones comerciales o políticas ajenas a la universidad.</p>
            </div>
          </div>
          <div className="about-flow-step">
            <div className="about-flow-step-num">3</div>
            <div className="about-flow-step-body">
              <p><strong>Privacidad (Doxxing).</strong> Exposición de datos personales, números de contacto o información privada sin consentimiento.</p>
            </div>
          </div>
          <div className="about-flow-step">
            <div className="about-flow-step-num">4</div>
            <div className="about-flow-step-body">
              <p><strong>Fraude o Piratería.</strong> Distribución de material con derechos de autor, venta de exámenes o promoción de deshonestidad académica.</p>
            </div>
          </div>
        </div>
      </div>

      <hr className="about-divider" />

      <div className="about-section">
        <h2>Apelaciones y Suspensión de Cuentas</h2>
        <p>Las apelaciones son revisadas manualmente por la administración. Tras la revisión, el contenido puede ser <strong>Restaurado</strong> (si el ocultamiento fue injustificado) o <strong>Rechazado</strong> (el ocultamiento se hace permanente).</p>
        <p>En casos de infracciones graves, coordinadas, o abuso reiterado de las normas, la administración se reserva el derecho de <strong>suspender cuentas de forma permanente</strong>. Las cuentas suspendidas pierden acceso a la plataforma, aunque su historial público puede preservarse por motivos de contexto arquitectónico del foro.</p>
      </div>

      <div className="about-central-callout">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        <span>Visitá el <strong><a href="/central/moderation/moderation-policy.html" target="_blank" rel="noreferrer">centro de ayuda</a></strong> para obtener información más detallada acerca de la política de moderación de contenido.</span>
      </div>

      <div className="about-footer">
        <span className="about-footer-note">Última actualización: mayo 2026</span>
        <Link to="/about" className="about-btn-back">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Volver
        </Link>
      </div>
    </div>
    </div>
    </>
  )
}
