import { Link } from 'react-router-dom'
import './about.css'

const CHECK_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)

const LOCK_ICON = (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
)

export function ContentPoliciesPage() {
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
        <h1>Política de preservación de contenido</h1>
        <p>UdelarHITS se basa en la construcción colectiva del conocimiento. Las reglas de eliminación de contenido están diseñadas para proteger el contexto de los debates y evitar que la información útil se pierda de forma unilateral.</p>
      </div>

      <div className="about-section">
        <h2>El principio de coautoría y contexto</h2>
        <p>Cuando publicás un contenido y otros usuarios invierten tiempo en responder, debatir o construir sobre él, ese hilo deja de pertenecerte exclusivamente a vos. Pasa a formar parte del conocimiento colectivo de la comunidad.</p>
        <p>Permitir la eliminación arbitraria de contenido con respuestas destruiría el contexto de las discusiones (hilos huérfanos). Por lo tanto, <strong>ningún usuario ni moderador puede eliminar definitivamente contenido que ya haya generado interacción pública.</strong></p>
      </div>

      <hr className="about-divider" />

      <div className="about-section">
        <h2>Qué podés eliminar libremente</h2>
        <p>La eliminación es definitiva y está bajo tu control total en los siguientes escenarios (ausencia de interacción):</p>
        <ul className="about-rules-list">
          <li>
            <span className="about-rule-icon about-rule-icon--ok">{CHECK_ICON}</span>
            <span>Tu propio <strong>comentario</strong>, siempre y cuando no tenga ninguna respuesta anidada.</span>
          </li>
          <li>
            <span className="about-rule-icon about-rule-icon--ok">{CHECK_ICON}</span>
            <span>Tu propio <strong>tema</strong>, siempre y cuando no haya recibido ningún comentario.</span>
          </li>
          <li>
            <span className="about-rule-icon about-rule-icon--ok">{CHECK_ICON}</span>
            <span>Tu propia <strong>categoría</strong>, siempre y cuando esté completamente vacía de temas.</span>
          </li>
        </ul>
      </div>

      <hr className="about-divider" />

      <div className="about-section">
        <h2>Qué se preserva (Bloqueo de eliminación)</h2>
        <ul className="about-rules-list">
          <li>
            <span className="about-rule-icon about-rule-icon--lock">{LOCK_ICON}</span>
            <span>Todo comentario que haya recibido al menos una respuesta.</span>
          </li>
          <li>
            <span className="about-rule-icon about-rule-icon--lock">{LOCK_ICON}</span>
            <span>Todo tema que contenga actividad de terceros.</span>
          </li>
          <li>
            <span className="about-rule-icon about-rule-icon--lock">{LOCK_ICON}</span>
            <span>Toda categoría que contenga actividad de terceros.</span>
          </li>
        </ul>
      </div>

      <hr className="about-divider" />

      <div className="about-section">
        <h2>Inactivación voluntaria de contenido ("Borrado suave")</h2>
        <p>Si bien no podés destruir un hilo interactivo, sí podés desvincularte de él. Al intentar eliminar un contenido con actividad, este pasa a un estado <strong>Inactivo</strong>:</p>
        <div className="about-scenario-list">
          <div className="about-scenario">
            <div className="about-scenario-label">Comentarios</div>
            <p>El texto de tu comentario y tu autoría se ocultan, reemplazándose por un aviso de eliminación. Sin embargo, la estructura del árbol y las respuestas de los demás usuarios permanecen intactas.</p>
          </div>
          <div className="about-scenario">
            <div className="about-scenario-label">Temas y Categorías</div>
            <p>La categoría desaparece de los listados y feeds principales, cesando su exposición pública. No obstante, los hilos de comentarios internos siguen existiendo y son accesibles mediante su enlace directo, preservando el archivo histórico.</p>
          </div>
        </div>
      </div>

      <hr className="about-divider" />

      <div className="about-section">
        <h2>Desactivación de perfil</h2>
        <p>Si decidís dar de baja tu cuenta, tu información personal se inhabilita, pero tu contenido publicado (comentarios y temas) se mantendrá en la plataforma bajo un identificador anónimo o inactivo, para mantener la coherencia de los debates pasados. Tu cuenta puede reactivarse en cualquier momento contactando a la administración.</p>
      </div>

      <div className="about-central-callout">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        {/* TODO: link a La Central /central/info/preservacion.html — se conecta en Etapa 5 */}
        <span>Visitá el <strong><a href="#" onClick={e => e.preventDefault()}>centro de ayuda</a></strong> para obtener información más detallada acerca de la política de preservación de contenido.</span>
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
