import { facultadBySigla } from '../../config/facultades'

// Píldora del filtro por etiqueta que vive DENTRO del contenedor del buscador,
// a la izquierda del texto libre. No es texto del <input>: es un elemento
// hermano, para que el conjunto parezca un solo campo. Se deriva del search
// param `etiqueta` (fuente de verdad = URL), no de estado local.
//
// Lleva el color de la facultad (mapa en config/facultades.js). Si la etiqueta
// no es una facultad (click a una etiqueta cualquiera del dropdown), cae al
// color de acento. El aria-label es el nombre completo, no la sigla.
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
