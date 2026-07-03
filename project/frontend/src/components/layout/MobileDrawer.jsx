import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import './MobileDrawer.css'

// Drawer lateral para mobile (≤768px). Se abre con swipe right desde el borde
// izquierdo o tocando la columna indicadora, y se cierra con swipe left o
// tocando el overlay. Replica las opciones del LeftNav (sin Administración) y
// reutiliza sus estilos (.nav-item). Solo visible en mobile vía CSS; en desktop
// el CSS lo oculta y estos handlers no hacen nada (guard por matchMedia).
export function MobileDrawer() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)

  // Gestos táctiles nativos (touchstart/touchend), sin librerías.
  useEffect(() => {
    let startX = 0
    let startY = 0
    let tracking = false
    const isMobile = () => window.matchMedia('(max-width: 768px)').matches
    const EDGE = 24   // zona del borde izquierdo para iniciar la apertura
    const THRESHOLD = 50 // desplazamiento horizontal mínimo del swipe

    function onStart(e) {
      if (!isMobile()) return
      const t = e.touches[0]
      startX = t.clientX
      startY = t.clientY
      // Si está cerrado, solo trackeamos gestos que empiezan cerca del borde
      // (para no interferir con scrolls horizontales del contenido). Si está
      // abierto, trackeamos desde cualquier punto para poder cerrarlo.
      tracking = open || startX <= EDGE
    }

    function onEnd(e) {
      if (!isMobile() || !tracking) return
      tracking = false
      const t = e.changedTouches[0]
      const dx = t.clientX - startX
      const dy = t.clientY - startY
      // Debe ser un gesto predominantemente horizontal.
      if (Math.abs(dx) < THRESHOLD || Math.abs(dx) <= Math.abs(dy)) return
      if (!open && dx > THRESHOLD && startX <= EDGE) setOpen(true)
      else if (open && dx < -THRESHOLD) setOpen(false)
    }

    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend', onEnd)
    }
  }, [open])

  function navClass(path) {
    const active = path === '/' ? pathname === '/' : pathname.startsWith(path)
    return `nav-item${active ? ' active' : ''}`
  }

  // Notificaciones y Guardados abren sus paneles (manejados por LeftNav, que
  // sigue montado en mobile aunque esté oculto) y cierran el drawer.
  function openNotif() {
    setOpen(false)
    window.dispatchEvent(new CustomEvent('toggle-notif-panel'))
  }
  function openSaved() {
    setOpen(false)
    window.dispatchEvent(new CustomEvent('toggle-saved-panel'))
  }

  return (
    <>
      {/* Columna indicadora en el borde izquierdo */}
      <button
        className="mobile-drawer-edge"
        type="button"
        aria-label="Abrir menú de navegación"
        onClick={() => setOpen(true)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Overlay semitransparente sobre el resto de la pantalla */}
      <div
        className={`mobile-drawer-overlay${open ? ' open' : ''}`}
        onClick={() => setOpen(false)}
      />

      {/* Drawer */}
      <nav className={`mobile-drawer${open ? ' open' : ''}`} aria-hidden={!open}>
        <Link to="/" className={navClass('/')} onClick={() => setOpen(false)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 11 9-8 9 8" />
            <path d="M5 10v10h14V10" />
          </svg>
          Inicio
        </Link>

        <Link to="/explore" className={navClass('/explore')} onClick={() => setOpen(false)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          Explorar
        </Link>

        <button className="nav-item" type="button" onClick={openNotif}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
            <path d="M10 21a2 2 0 0 0 4 0" />
          </svg>
          Notificaciones
        </button>

        <Link to="/chat" className={navClass('/chat')} onClick={() => setOpen(false)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Chat
        </Link>

        <div className="nav-divider" />

        <Link to="/popular" className={navClass('/popular')} onClick={() => setOpen(false)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
          Populares
        </Link>

        <Link to="/recent" className={navClass('/recent')} onClick={() => setOpen(false)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Recientes
        </Link>

        <button className="nav-item" type="button" onClick={openSaved}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          Guardados
        </button>

        <Link to="/about" className={`${navClass('/about')} mobile-drawer-about`} onClick={() => setOpen(false)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          Quienes somos
        </Link>

        <Link to="/settings" className={navClass('/settings')} onClick={() => setOpen(false)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Configuración
        </Link>
      </nav>
    </>
  )
}
