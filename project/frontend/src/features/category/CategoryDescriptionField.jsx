import { useState, useRef, useEffect } from 'react'
import { ReadMore } from '../../components/ui/ReadMore'

// Campo de descripción de categoría con tabs Editar / Vista previa. Compartido
// entre editar (EditCategoryModal) y crear (CreateCategoryPanel) para que ambos
// se comporten idéntico.
//
// - Editar: textarea auto-expandible (crece con el contenido hasta el max-height
//   del CSS, donde aparece scroll).
// - Vista previa: renderiza la descripción con EXACTAMENTE el mismo markup que la
//   página real de categoría — <p class="cat-desc"> + <ReadMore> —, así el arte
//   ASCII, los espacios, los saltos de línea y el truncado "Leer más" se ven
//   igual que en CategoryPage. Sin estilos propios para el texto.
export function CategoryDescriptionField({ value, onChange, maxLength = 750, placeholder }) {
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
            <span>Descripción (*)</span>
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
          {/* Mismo markup que CategoryPage: <p class="cat-desc"> + ReadMore. */}
          <p className="cat-desc">
            {value.trim()
              ? <ReadMore text={value} maxLength={500} />
              : <span className="edit-preview-empty">Sin descripción</span>}
          </p>
          <p className="edit-preview-note">
            La vista previa puede variar ligeramente según el dispositivo.
          </p>
        </div>
      )}
    </div>
  )
}
