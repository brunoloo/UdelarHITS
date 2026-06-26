import { useEffect } from 'react'
import './ImageLightbox.css'

// Visor de imagen a pantalla completa dentro de UdelarHITS (misma lógica que el
// modal de la foto de perfil: cruz arriba a la izquierda, fondo oscuro).
export function ImageLightbox({ src, alt, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!src) return null

  return (
    <div className="image-lightbox open" onClick={onClose}>
      <button className="image-lightbox-close" type="button" onClick={onClose} aria-label="Cerrar">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <img
        className="image-lightbox-img"
        src={src}
        alt={alt || ''}
        onClick={e => e.stopPropagation()}
      />
    </div>
  )
}
