import './AccordionField.css'

// Campo colapsable. El contenido queda siempre montado para conservar el estado del usuario.
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
