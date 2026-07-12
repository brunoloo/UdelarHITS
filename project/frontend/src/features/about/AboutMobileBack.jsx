import { useNavigate } from 'react-router-dom'

// Barra superior fija, SOLO en mobile. Las rutas /about* viven fuera del
// AppLayout, así que no tienen drawer, header ni bottom-nav: sin esto el usuario
// queda sin forma visible de volver a la app (el botón "Inicio" del pie de
// página queda a ~1000px de scroll). Oculta en desktop vía CSS: no toca el
// layout de escritorio.
export function AboutMobileBack() {
  const navigate = useNavigate()

  function handleBack() {
    // Vuelve a donde estaba el usuario (normalmente la página desde la que abrió
    // el menú). Si no hay historial (deep-link directo), va al inicio.
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  return (
    <div className="about-mobile-back">
      <button type="button" onClick={handleBack} aria-label="Volver">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Volver
      </button>
    </div>
  )
}
