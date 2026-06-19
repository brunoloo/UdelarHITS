import { Link } from 'react-router-dom'
import './about.css'

const LOCK_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)

export function RulesPage() {
  return (
    <div className="about-page-wrap">
    <div className="about-container">
      <div className="about-page-header">
        <Link to="/about" className="about-breadcrumb">
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
          Acerca de UdelarHITS
        </Link>
        <h1>Normas de la comunidad</h1>
        <p>Participar en UdelarHITS implica un compromiso estricto con estas normas. Están diseñadas para garantizar un entorno académico seguro, riguroso y respetuoso para todos los estudiantes y docentes.</p>
      </div>

      <div className="about-section">
        <h2>Convivencia y Respeto</h2>
        <div className="about-flow" style={{ marginTop: 16 }}>
          <div className="about-flow-step">
            <div className="about-flow-step-num">1</div>
            <div className="about-flow-step-body">
              <p><strong>Cero tolerancia al acoso.</strong> No se permite el acoso, la intimidación, el insulto ni ninguna forma de discriminación por origen, género, orientación sexual, ideología o facultad. Tratá a los demás con el respeto que exige un ámbito universitario.</p>
            </div>
          </div>
          <div className="about-flow-step">
            <div className="about-flow-step-num">2</div>
            <div className="about-flow-step-body">
              <p><strong>Debate constructivo.</strong> Es válido estar en desacuerdo, pero el debate debe centrarse en los argumentos, no en las personas. Criticá las ideas, no a quien las expone.</p>
            </div>
          </div>
          <div className="about-flow-step">
            <div className="about-flow-step-num">3</div>
            <div className="about-flow-step-body">
              <p><strong>Privacidad y Doxxing.</strong> Está estrictamente prohibido publicar información personal de terceros (estudiantes o docentes) sin su consentimiento explícito, incluyendo números de teléfono, direcciones, documentos de identidad o redes sociales privadas.</p>
            </div>
          </div>
        </div>
      </div>

      <hr className="about-divider" />

      <div className="about-section">
        <h2>Integridad Académica y Calidad</h2>
        <div className="about-flow" style={{ marginTop: 16 }}>
          <div className="about-flow-step">
            <div className="about-flow-step-num">4</div>
            <div className="about-flow-step-body">
              <p><strong>Legalidad y Derechos de Autor.</strong> No utilices la plataforma para distribuir material protegido por derechos de autor (ej. copias ilegales de libros) ni software sin licencia.</p>
            </div>
          </div>
          <div className="about-flow-step">
            <div className="about-flow-step-num">5</div>
            <div className="about-flow-step-body">
              <p><strong>Fraude académico.</strong> Está prohibido solicitar, ofrecer o promover el fraude académico, incluyendo la compra/venta de exámenes, trabajos prácticos o suplantación de identidad en evaluaciones.</p>
            </div>
          </div>
          <div className="about-flow-step">
            <div className="about-flow-step-num">6</div>
            <div className="about-flow-step-body">
              <p><strong>Información rigurosa.</strong> Si compartís información institucional (fechas de parciales, requisitos de previaturas, resoluciones de facultad), asegurate de que sea correcta o aclará explícitamente que es un rumor. La desinformación académica perjudica a toda la comunidad.</p>
            </div>
          </div>
          <div className="about-flow-step">
            <div className="about-flow-step-num">7</div>
            <div className="about-flow-step-body">
              <p><strong>Títulos descriptivos y ubicación.</strong> Los títulos deben resumir claramente el problema (ej. "Duda sobre ejercicio 3 de Cálculo 1" en lugar de "Ayuda por favor"). Asegurate de publicar en la categoría correspondiente.</p>
            </div>
          </div>
        </div>
      </div>

      <hr className="about-divider" />

      <div className="about-section">
        <h2>Cuentas y Uso de la Plataforma</h2>
        <div className="about-flow" style={{ marginTop: 16 }}>
          <div className="about-flow-step">
            <div className="about-flow-step-num">8</div>
            <div className="about-flow-step-body">
              <p><strong>Spam y autopromoción.</strong> No publiques el mismo contenido de forma repetitiva ni utilices el foro para campañas publicitarias, políticas o comerciales ajenas al ámbito universitario.</p>
            </div>
          </div>
          <div className="about-flow-step">
            <div className="about-flow-step-num">9</div>
            <div className="about-flow-step-body">
              <p><strong>Identidad honesta.</strong> Tu perfil no puede suplantar la identidad de otra persona real, docente, agrupación estudiantil, institución o autoridad de la Universidad de la República.</p>
            </div>
          </div>
        </div>
      </div>

      <hr className="about-divider" />

      <div className="about-section">
        <h2>Moderación</h2>
        <p>Las violaciones a estas reglas resultarán en el ocultamiento del contenido, advertencias formales o la suspensión definitiva de la cuenta, dependiendo de la gravedad. El proceso está documentado en la <Link to="/about/moderation" className="about-inline-link">página de moderación y reportes</Link>.</p>
      </div>

      <div className="about-central-callout">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        {/* TODO: link a La Central /central/info/normas.html — se conecta en Etapa 5 */}
        <span>Visitá el <strong><a href="#" onClick={e => e.preventDefault()}>centro de ayuda</a></strong> para obtener información más detallada acerca de las normas de la comunidad.</span>
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
  )
}
