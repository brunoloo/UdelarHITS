import { useState } from 'react'
import { FileText, FileSpreadsheet, Archive, File, Clock, ShieldAlert } from 'lucide-react'
import { formatBytes } from '../../utils/formatBytes'
import { documentDownloadUrl, descargarConNombre } from '../../utils/attachments'
import { cloudinaryResize } from '../../utils/cloudinaryUrl'
import { ImageLightbox } from './ImageLightbox'
import './CommentAttachments.css'

function iconForName(name = '') {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return FileText
  if (ext === 'xls' || ext === 'xlsx') return FileSpreadsheet
  if (ext === 'zip' || ext === 'rar') return Archive
  return File
}

// maxWidth: ancho al que se pide la imagen (600 en el feed, 1200 en la vista completa); el
// visor usa la original. priority: la primera imagen se carga con prioridad alta por ser
// candidata a LCP.
export function CommentAttachments({ adjuntos, maxWidth = 1200, priority = false }) {
  const [lightbox, setLightbox] = useState(null)
  const [descargandoId, setDescargandoId] = useState(null)

  if (!adjuntos || adjuntos.length === 0) return null

  const imagenes = adjuntos.filter(a => a.tipo === 'imagen')
  const documentos = adjuntos.filter(a => a.tipo !== 'imagen')

  return (
    <div className="comment-attachments" onClick={e => e.stopPropagation()}>
      {imagenes.length > 0 && (
        <div className="ca-images">
          {imagenes.map((a, idx) => {
            // Solo se muestra la imagen si está publicada; en revisión o rechazada va un placeholder.
            if (a.estado === 'pendiente_revision') {
              return (
                <div key={a.id} className="ca-image-placeholder ca-image-placeholder--pending">
                  <Clock size={18} />
                  <span>Imagen en revisión</span>
                </div>
              )
            }
            if (a.estado === 'rechazado') {
              return (
                <div key={a.id} className="ca-image-placeholder ca-image-placeholder--rejected">
                  <ShieldAlert size={18} />
                  <span>Imagen eliminada por moderación</span>
                </div>
              )
            }
            // El visor recibe la URL original; en la card va una versión redimensionada.
            const isLcp = priority && idx === 0
            return (
              <button
                key={a.id}
                type="button"
                className="ca-image-link"
                title={a.nombre_original}
                onClick={() => setLightbox({ src: a.url, alt: a.nombre_original })}
              >
                <img
                  src={cloudinaryResize(a.url, maxWidth)}
                  alt={a.nombre_original}
                  loading={isLcp ? 'eager' : 'lazy'}
                  fetchPriority={isLcp ? 'high' : undefined}
                  decoding="async"
                />
              </button>
            )
          })}
        </div>
      )}

      {documentos.map(a => {
        const Icon = iconForName(a.nombre_original)
        const href = documentDownloadUrl(a.url)
        const descargando = descargandoId === a.id
        const handleClick = async (e) => {
          // Con modificadores (nueva pestaña, etc.) o sin nombre, el enlace se comporta como siempre.
          if (!a.nombre_original || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
          e.preventDefault()
          if (descargandoId) return
          setDescargandoId(a.id)
          try {
            await descargarConNombre(href, a.nombre_original)
          } finally {
            setDescargandoId(null)
          }
        }
        return (
          <a
            key={a.id}
            href={href}
            rel="noopener noreferrer"
            download={a.nombre_original}
            className={`ca-doc${descargando ? ' ca-doc--loading' : ''}`}
            aria-busy={descargando || undefined}
            onClick={handleClick}
          >
            <span className="ca-doc-icon"><Icon size={20} /></span>
            <span className="ca-doc-info">
              <span className="ca-doc-name">{a.nombre_original}</span>
              <span className="ca-doc-size">{descargando ? 'Descargando…' : formatBytes(a.tamano)}</span>
            </span>
          </a>
        )
      })}

      {lightbox && (
        <ImageLightbox
          src={lightbox.src}
          alt={lightbox.alt}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  )
}
