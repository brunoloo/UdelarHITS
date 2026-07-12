import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import './about.css'

const ARROW_ICON = (
  <svg className="about-info-card-arrow" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/>
    <polyline points="12 5 19 12 12 19"/>
  </svg>
)

export function AboutPage() {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  return (
    <div className="about-page-wrap">
    <div className="about-container">
      <div className="about-page-header">
        <Link to="/" className="about-logo">Udelar<span>HITS</span></Link>
        <h1>Acerca de la plataforma</h1>
        <p>Todo lo que necesitás saber sobre la comunidad, sus normativas, cómo funciona nuestro sistema y qué esperamos de quienes participan en el foro.</p>
      </div>

      <div className="about-section">
        <h2>¿Qué es UdelarHITS?</h2>
        <p>UdelarHITS es un foro universitario diseñado para la comunidad de la Universidad de la República (Uruguay). Nuestro objetivo es centralizar, organizar y democratizar el conocimiento académico y estudiantil que habitualmente se pierde en redes sociales efímeras y grupos cerrados.</p>
        <p>Es un espacio abierto para resolver dudas sobre asignaturas, debatir resoluciones institucionales, compartir recursos bibliográficos de acceso libre y conectar transversalmente con estudiantes y docentes de todas las facultades.</p>
        <p><em>Aviso Legal: Este es un proyecto de desarrollo independiente gestionado por estudiantes. No posee afiliación, patrocinio ni aval oficial del rectorado ni de las facultades de la Universidad de la República.</em></p>
      </div>

      <hr className="about-divider" />

      <div className="about-section">
        <h2>Documentación y Normativas</h2>
        <p>La participación activa en UdelarHITS está condicionada a la lectura y aceptación de las siguientes políticas institucionales:</p>

        <div className="about-info-cards">
          <Link to="/about/rules" className="about-info-card">
            <div className="about-info-card-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
                <polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
            <div className="about-info-card-body">
              <span className="about-info-card-title">Normas de la comunidad</span>
              <span className="about-info-card-desc">Normas estrictas de convivencia, integridad académica y calidad de contenido esperadas.</span>
            </div>
            {ARROW_ICON}
          </Link>

          <Link to="/about/policies" className="about-info-card">
            <div className="about-info-card-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </div>
            <div className="about-info-card-body">
              <span className="about-info-card-title">Política de preservación</span>
              <span className="about-info-card-desc">Archivado de contenido colectivo y normativas sobre la eliminación de temas o comentarios.</span>
            </div>
            {ARROW_ICON}
          </Link>

          <Link to="/about/moderation" className="about-info-card">
            <div className="about-info-card-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div className="about-info-card-body">
              <span className="about-info-card-title">Moderación y reportes</span>
              <span className="about-info-card-desc">Transparencia sobre nuestro sistema de auditoría comunitaria, ocultamientos y apelaciones.</span>
            </div>
            {ARROW_ICON}
          </Link>
        </div>
      </div>

      <hr className="about-divider" />

      <div className="about-section">
        <h2>Contacto</h2>
        <p>Si encontrás vulnerabilidades en el sistema, querés reportar un problema grave de seguridad o necesitás comunicarte con la administración del proyecto, podés escribirnos al correo oficial:</p>
        <a href="mailto:udelarhits@gmail.com" className="about-contact-chip">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2" ry="2"/>
            <path d="M2 4l10 8 10-8"/>
          </svg>
          udelarhits@gmail.com
        </a>
      </div>

      <div className="about-central-callout">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        <span>Visitá el <strong><a href="/central" target="_blank" rel="noreferrer">centro de ayuda</a></strong> para obtener información más detallada acerca de este proyecto, nuestro centro de referencia institucional.</span>
      </div>

      <div className="about-footer">
        <span className="about-footer-note">UdelarHITS · Hecho por estudiantes, para estudiantes</span>
        <Link to="/" className="about-btn-back">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Inicio
        </Link>
      </div>
    </div>
    </div>
  )
}
