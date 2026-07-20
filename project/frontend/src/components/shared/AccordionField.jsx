import './AccordionField.css'

// Campo colapsable tipo acordeón. Cerrado se ve como un input (rectángulo con
// borde) con un texto-resumen; abierto muestra su contenido con una transición
// suave de altura. El contenido vive siempre montado (no se desmonta al cerrar),
// así el estado del usuario se preserva. Quién lo usa maneja qué panel está
// abierto (single-open): abrir uno cierra el otro.
//
// Props:
//   open       — si está expandido
//   onToggle   — click en el header (abrir/cerrar)
//   title      — nombre del campo (para el aria-label)
//   summary    — texto del estado cerrado (placeholder o preview del contenido)
//   hasContent — si hay contenido (para no pintar el resumen como placeholder)
export function AccordionField({ open, onToggle, title, summary, hasContent, children }) {
  return (
    <div className={`acc-field${open ? ' acc-field--open' : ''}`}>
      <button
        type="button"
        className="acc-field-summary"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? `Cerrar ${title}` : `Abrir ${title}`}
      >
        {!open && (
          <span className={`acc-field-summary-text${hasContent ? '' : ' acc-field-summary-text--empty'}`}>
            {summary}
          </span>
        )}
        <svg className="acc-field-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>
      <div className="acc-field-collapse">
        <div className="acc-field-collapse-inner">
          {children}
        </div>
      </div>
    </div>
  )
}
