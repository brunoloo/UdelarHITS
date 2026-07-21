import './PreviewHint.css'

// Nota informativa que va DEBAJO del panel de descripción (fuera de su borde),
// con un ícono a la izquierda. Aviso de que la vista previa es orientativa.
export function PreviewHint() {
  return (
    <p className="preview-hint">
      <svg className="preview-hint-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      <span>La vista previa puede variar ligeramente según el dispositivo.</span>
    </p>
  )
}
