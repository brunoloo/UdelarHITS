import { useNavigate } from 'react-router-dom'
import './Tag.css'

export function Tag({ label, clickable = true }) {
  const navigate = useNavigate()

  if (clickable) {
    return (
      <button
        type="button"
        className="tag tag--link"
        onClick={e => {
          e.stopPropagation()
          e.preventDefault()
          // Filtro exacto por etiqueta, no ?q=. `label` es etiqueta.nombre, que es con lo que compara el backend.
          navigate(`/?etiqueta=${encodeURIComponent(label)}`)
        }}
      >
        {label}
      </button>
    )
  }

  return <span className="tag">{label}</span>
}
