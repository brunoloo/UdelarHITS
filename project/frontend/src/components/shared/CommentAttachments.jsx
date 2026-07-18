import { useState } from 'react'
import { FileText, FileSpreadsheet, Archive, File, Clock, ShieldAlert } from 'lucide-react'
import { formatBytes } from '../../utils/formatBytes'
import { documentDownloadUrl } from '../../utils/attachments'
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

// Renderiza los adjuntos de un comentario: imágenes que abren en un visor (modal)
// dentro del sitio y documentos como links de descarga.
//
// maxWidth: ancho máximo (px) al que se sirve la imagen desde Cloudinary. En el
// feed (previews de comentarios dentro de las cards) nunca se muestra a más de
// ~500px, así que 600 alcanza; en la vista completa de un tema se muestra más
// grande (1200). Al abrir el Lightbox SIEMPRE se usa la URL original —ahí sí
// queremos resolución completa.
//
// priority: cuando la primera imagen es (o puede ser) el elemento LCP —el
// primer adjunto del primer card del feed— se carga con loading="eager" y
// fetchpriority="high" para no retrasar el LCP. El resto queda con lazy.
export function CommentAttachments({ adjuntos, maxWidth = 1200, priority = false }) {
  const [lightbox, setLightbox] = useState(null)

  if (!adjuntos || adjuntos.length === 0) return null

  const imagenes = adjuntos.filter(a => a.tipo === 'imagen')
  const documentos = adjuntos.filter(a => a.tipo !== 'imagen')

  return (
    <div className="comment-attachments" onClick={e => e.stopPropagation()}>
      {imagenes.length > 0 && (
        <div className="ca-images">
          {imagenes.map((a, idx) => {
            // Moderación: solo se renderiza la imagen real si está 'publicado'.
            // 'pendiente_revision' y 'rechazado' muestran un placeholder y no
            // exponen la imagen (ni abren el visor).
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
            // El Lightbox recibe la URL ORIGINAL (a.url): al ampliar queremos
            // resolución completa. En la card se sirve una versión redimensionada.
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
        return (
          <a
            key={a.id}
            href={documentDownloadUrl(a.url)}
            rel="noopener noreferrer"
            download={a.nombre_original}
            className="ca-doc"
          >
            <span className="ca-doc-icon"><Icon size={20} /></span>
            <span className="ca-doc-info">
              <span className="ca-doc-name">{a.nombre_original}</span>
              <span className="ca-doc-size">{formatBytes(a.tamano)}</span>
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
