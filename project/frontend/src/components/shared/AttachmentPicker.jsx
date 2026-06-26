import { useRef, useMemo } from 'react'
import { Paperclip, X, FileText, FileSpreadsheet, Archive, File } from 'lucide-react'
import { useToast } from '../../hooks/useToast'
import {
  ACCEPT_ATTR,
  MAX_ARCHIVOS,
  esImagen,
  validarArchivo,
} from '../../utils/attachments'
import { formatBytes } from '../../utils/formatBytes'
import './AttachmentPicker.css'

function iconForName(name) {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return FileText
  if (ext === 'xls' || ext === 'xlsx') return FileSpreadsheet
  if (ext === 'zip' || ext === 'rar') return Archive
  return File
}

// Selector de adjuntos reutilizable. `files` es un array de File controlado por
// el padre; `onChange` recibe el nuevo array.
export function AttachmentPicker({ files, onChange, disabled = false }) {
  const inputRef = useRef(null)
  const { showToast } = useToast()

  // URLs de preview para imágenes (se recrean cuando cambia la lista).
  const previews = useMemo(
    () => files.map(f => (esImagen(f) ? URL.createObjectURL(f) : null)),
    [files]
  )

  function handlePick(e) {
    const picked = Array.from(e.target.files || [])
    e.target.value = '' // permite volver a elegir el mismo archivo
    if (picked.length === 0) return

    let next = [...files]
    for (const f of picked) {
      if (next.length >= MAX_ARCHIVOS) {
        showToast(`Máximo ${MAX_ARCHIVOS} archivos por comentario`, 'error')
        break
      }
      const v = validarArchivo(f)
      if (!v.ok) {
        showToast(v.error, 'error')
        continue
      }
      next.push(f)
    }
    onChange(next)
  }

  function removeAt(idx) {
    onChange(files.filter((_, i) => i !== idx))
  }

  return (
    <div className="attach-zone" onClick={e => e.stopPropagation()}>
      <div className="attach-actions">
        <button
          type="button"
          className="attach-btn"
          title="Adjuntar archivos"
          disabled={disabled || files.length >= MAX_ARCHIVOS}
          onClick={() => inputRef.current?.click()}
        >
          <Paperclip size={18} />
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT_ATTR}
          style={{ display: 'none' }}
          onChange={handlePick}
        />
      </div>

      {files.length > 0 && (
        <div className="attach-previews">
          {files.map((f, i) => {
            const Icon = iconForName(f.name)
            return (
              <div className="attach-chip" key={`${f.name}-${i}`}>
                {previews[i] ? (
                  <img className="attach-thumb" src={previews[i]} alt={f.name} />
                ) : (
                  <span className="attach-doc-icon"><Icon size={18} /></span>
                )}
                <span className="attach-chip-info">
                  <span className="attach-chip-name" title={f.name}>{f.name}</span>
                  <span className="attach-chip-size">{formatBytes(f.size)}</span>
                </span>
                <button
                  type="button"
                  className="attach-chip-remove"
                  title="Quitar"
                  onClick={() => removeAt(i)}
                >
                  <X size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
