import { Link } from 'react-router-dom'
import './EmptyState.css'

// Estado vacío con salida: además del mensaje, un enlace a algo que sí tiene contenido.
// `className` es el contenedor propio de cada pantalla (padding y tipografía ya definidos ahí).
export function EmptyState({ message, to, label, className = '', onNavigate }) {
  return (
    <div className={`empty-state${className ? ' ' + className : ''}`}>
      <p className="empty-state-msg">{message}</p>
      {to && label && (
        <Link className="empty-state-cta" to={to} onClick={onNavigate}>{label}</Link>
      )}
    </div>
  )
}
