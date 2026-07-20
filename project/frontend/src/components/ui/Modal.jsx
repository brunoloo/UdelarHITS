import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import './Modal.css'

// Por defecto los modales se cierran ÚNICAMENTE con la cruz (o sus botones):
// ni el click fuera ni Escape cierran, para no perder lo que se está editando.
// Los visores de imagen (avatar/pfp, lightbox) son componentes aparte y sí
// cierran al clickear fuera. Un modal puntual puede reactivar el cierre por
// backdrop/Escape con closeOnBackdrop / closeOnEscape.
export function Modal({ isOpen, onClose, title, children, headerAction, className = '', backdropClassName = '', closeOnBackdrop = false, closeOnEscape = false }) {
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose, closeOnEscape])

  // Se renderiza en document.body para que el modal quede centrado en la pantalla
  // aunque su origen esté dentro de un contenedor con transform (p. ej. el panel
  // de guardados/notificaciones, que usa translateX para deslizarse).
  return createPortal(
    <div
      className={`modal-backdrop${isOpen ? ' open' : ''}${backdropClassName ? ' ' + backdropClassName : ''}`}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div className={`modal${className ? ' ' + className : ''}`} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <button className="modal-close" type="button" onClick={onClose} aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <h3>{title}</h3>
          {headerAction}
        </div>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
