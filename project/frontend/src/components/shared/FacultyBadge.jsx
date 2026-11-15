import './FacultyBadge.css'

// Abreviatura de la facultad junto al nickname. No reusa <Tag>, que navega a un filtro:
// esto es solo informativo.
export function FacultyBadge({ facultad }) {
  if (!facultad) return null

  return <span className="faculty-badge">{facultad}</span>
}
