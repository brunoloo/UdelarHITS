import './FacultyBadge.css'

// Etiqueta con la ABREVIATURA de la facultad del autor (p. ej. "FING"), que va
// al lado del nickname allí donde el usuario participa. En el perfil se muestra
// el nombre completo ("Facultad de Ingeniería"), que arma el backend.
//
// A propósito NO reusa <Tag>: aquel navega a /?etiqueta=... y esto es puramente
// informativo, no un filtro clickable.
//
// Props:
//   facultad — abreviatura (string) o null/undefined si el usuario no la cargó.
export function FacultyBadge({ facultad }) {
  if (!facultad) return null

  return <span className="faculty-badge">{facultad}</span>
}
