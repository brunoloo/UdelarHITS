import { facultadBySigla } from '../../config/facultades'

// La píldora es un elemento hermano del <input>, derivada del parámetro `etiqueta`. Toma el
// color de la facultad; si la etiqueta no es una facultad, el color de acento.
export function SearchPill({ etiqueta, onRemove }) {
  const fac = facultadBySigla(etiqueta)
  const color = fac ? fac.color : 'var(--accent)'
  const fullName = fac ? fac.nombre : etiqueta

  return (
    <span
      className={`search-pill${fac ? ' search-pill--fac' : ''}`}
      style={{ '--pill-color': color }}
      aria-label={fullName}
      title={fullName}
    >
      <span className="search-pill-dot" aria-hidden="true" />
      <span className="search-pill-label">{etiqueta}</span>
      <button
        type="button"
        className="search-pill-remove"
        aria-label={`Quitar filtro: ${fullName}`}
        onClick={onRemove}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </span>
  )
}
