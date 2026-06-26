import { FileText, FileSpreadsheet, Archive, File } from 'lucide-react'
import { formatBytes } from '../../utils/formatBytes'
import './CommentAttachments.css'

function iconForName(name = '') {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return FileText
  if (ext === 'xls' || ext === 'xlsx') return FileSpreadsheet
  if (ext === 'zip' || ext === 'rar') return Archive
  return File
}

// Renderiza los adjuntos de un comentario: imágenes clickeables y documentos
// como links de descarga.
export function CommentAttachments({ adjuntos }) {
  if (!adjuntos || adjuntos.length === 0) return null

  const imagenes = adjuntos.filter(a => a.tipo === 'imagen')
  const documentos = adjuntos.filter(a => a.tipo !== 'imagen')

  return (
    <div className="comment-attachments" onClick={e => e.stopPropagation()}>
      {imagenes.length > 0 && (
        <div className="ca-images">
          {imagenes.map(a => (
            <a
              key={a.id}
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="ca-image-link"
              title={a.nombre_original}
            >
              <img src={a.url} alt={a.nombre_original} loading="lazy" />
            </a>
          ))}
        </div>
      )}

      {documentos.map(a => {
        const Icon = iconForName(a.nombre_original)
        return (
          <a
            key={a.id}
            href={a.url}
            target="_blank"
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
    </div>
  )
}
