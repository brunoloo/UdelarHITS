import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import './Modal.css'

// Los modales se cierran solo con la cruz o sus botones, para no perder lo que se está
// editando; closeOnBackdrop y closeOnEscape lo reactivan.
export function Modal({ isOpen, onClose, title, children, headerAction, className = '', backdropClassName = '', closeOnBackdrop = false, closeOnEscape = false }) {
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose, closeOnEscape])

  // Portal a document.body: un contenedor con transform descentraría el modal.
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
