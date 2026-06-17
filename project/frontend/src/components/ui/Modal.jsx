import { useEffect } from 'react'
import './Modal.css'

export function Modal({ isOpen, onClose, title, children, headerAction }) {
  useEffect(() => {
    if (!isOpen) return
    function handleKey(e) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  return (
    <div
      className={`modal-backdrop${isOpen ? ' open' : ''}`}
      onClick={onClose}
    >
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <button className="modal-close" type="button" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <h3>{title}</h3>
          {headerAction}
        </div>
        {children}
      </div>
    </div>
  )
}
