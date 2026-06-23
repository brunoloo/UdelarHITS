import './landing.css'

export function BetaGatePage({ onEnter }) {
  return (
    <main className="landing-page">
      <section className="landing-card">
        <div className="landing-header">
          <span className="landing-badge">Acceso Exclusivo</span>
        </div>
        <h1 className="landing-title">Bienvenido a la Beta de Udelar<span>HITS</span></h1>
        <p className="landing-text">
          Estás por ingresar a una versión preliminar de nuestra plataforma. UdelarHITS es el nuevo espacio diseñado por y para estudiantes de la Universidad de la República. Aquí vas a poder debatir, compartir materiales y conectar con tu facultad.
        </p>
        <p className="landing-text">
          Como tester inicial, tu experiencia y tus comentarios son fundamentales para darle forma al futuro de la comunidad. ¡Explorá, participá y ayudanos a mejorar!
        </p>
        <div className="landing-actions">
          <button className="landing-btn" onClick={onEnter}>
            Ingresar al Foro
          </button>
        </div>
      </section>
    </main>
  )
}