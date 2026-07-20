import { useState, useRef, useEffect } from 'react'

// Campo de texto con tabs Editar / Vista previa, reutilizable. Quien lo usa provee
// `renderPreview(value)` para que la vista previa replique EXACTAMENTE cómo se ve
// el texto en su destino real (descripción de categoría, biografía del perfil,
// etc.): mismas clases y mismo componente que la página. Así lo que se ve en la
// preview es lo que se verá publicado.
//
// - Editar: textarea auto-expandible (crece con el contenido hasta el max-height
//   del CSS, donde aparece scroll).
// - Vista previa: oculta el textarea y muestra renderPreview(value); el texto se
//   preserva al alternar (un único estado, controlado por el padre).
export function PreviewTextField({
  value,
  onChange,
  label,
  maxLength = 750,
  placeholder,
  renderPreview,
}) {
  const [tab, setTab] = useState('editar')
  const textareaRef = useRef(null)

  // Auto-resize: recalcula al escribir y al volver al tab Editar (el textarea se
  // re-monta al salir de la preview y su alto vuelve a 0).
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${ta.scrollHeight}px`
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
            <span>{label}</span>
            <span className={`edit-field-counter${value.length >= maxLength - 20 ? ' limit' : ''}`}>
              {value.length} / {maxLength}
            </span>
          </div>
          <textarea
            ref={textareaRef}
            maxLength={maxLength}
            placeholder={placeholder}
            value={value}
            onChange={e => onChange(e.target.value)}
          />
        </div>
      ) : (
        <div className="edit-preview">
          {/* Se renderiza siempre, incluso vacío: sin texto placeholder, solo el
              mismo contenedor/estilos en blanco (renderPreview('') devuelve un
              contenedor vacío). */}
          {renderPreview(value)}
          <p className="edit-preview-note">
            La vista previa puede variar ligeramente según el dispositivo.
          </p>
        </div>
      )}
    </div>
  )
}
