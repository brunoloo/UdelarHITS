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
          // Filtro EXACTO por etiqueta (no ?q=): un chip ES una etiqueta, así que
          // clickearlo filtra por igualdad y deja la píldora en el buscador. `label`
          // es el etiqueta.nombre (nunca nombre_display), que es con lo que matchea
          // el backend. Con ?q= reaparecía el caso "Arquitectura" (substring de
          // título) a un click de distancia.
          navigate(`/?etiqueta=${encodeURIComponent(label)}`)
        }}
      >
        {label}
      </button>
    )
  }

  return <span className="tag">{label}</span>
}
