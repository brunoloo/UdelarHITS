import { useState, useRef, useEffect } from 'react'

// Campo con pestañas Editar y Vista previa. `renderPreview` debe usar las mismas clases y
// el mismo componente que el destino real.
export function PreviewTextField({
  value,
  onChange,
  label,
  maxLength = 1000,
  placeholder,
  renderPreview,
  // editorClassName: permite que el textarea envuelva el texto igual que su preview.
  editorClassName,
  // hideNote: quien consume muestra la nota por fuera.
  hideNote = false,
}) {
  const [tab, setTab] = useState('editar')
  const textareaRef = useRef(null)

  // Recalcula al escribir y al volver a Editar, donde el textarea se vuelve a montar.
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    // Oculto, scrollHeight da 0: se deja 'auto' para que no quede colapsado.
    if (ta.scrollHeight) ta.style.height = `${ta.scrollHeight}px`
  }, [value, tab])

  return (
    <div className="desc-field">
      <div className="section-tabs edit-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'editar'}
          className={`tab${tab === 'editar' ? ' active' : ''}`}
          onClick={() => setTab('editar')}
        >
          Editar
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'preview'}
          className={`tab${tab === 'preview' ? ' active' : ''}`}
          onClick={() => setTab('preview')}
        >
          Vista previa
        </button>
      </div>

      {tab === 'editar' ? (
        <div className="edit-field edit-field--desc">
          <div className="edit-field-label">
            {/* Span vacío sin label: mantiene el contador a la derecha */}
            <span>{label}</span>
            <span className={`edit-field-counter${value.length >= maxLength - 20 ? ' limit' : ''}`}>
              {value.length} / {maxLength}
            </span>
          </div>
          <textarea
            ref={textareaRef}
            className={editorClassName}
            maxLength={maxLength}
            placeholder={placeholder}
            value={value}
            onChange={e => onChange(e.target.value)}
          />
        </div>
      ) : (
        <div className="edit-preview">
          {/* Se renderiza siempre, incluso vacío. */}
          {renderPreview(value)}
          {!hideNote && (
            <p className="edit-preview-note">
              La vista previa puede variar ligeramente según el dispositivo.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
