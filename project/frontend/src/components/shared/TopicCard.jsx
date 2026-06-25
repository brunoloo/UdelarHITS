import { useNavigate, Link } from 'react-router-dom'
import { resolveAutor } from './AuthorDisplay'
import { UserAvatar } from './UserAvatar'
import { DropdownMenu } from '../ui/DropdownMenu'
import { PinIcon } from './PinIcon'
import { timeAgo } from '../../utils/timeAgo'
import './TopicCard.css'

// canPin / onTogglePin: solo el moderador (creador) de la categoría los recibe,
// para fijar/desanclar el tema desde el menú de 3 puntos.
export function TopicCard({ topic, canPin = false, onTogglePin }) {
  const navigate = useNavigate()

  const {
    contenido_id,
    titulo,
    cuerpo,
    fecha_creacion,
    contador_comentarios,
  } = topic

  const autor = resolveAutor(topic)
  const commentCount = Number(contador_comentarios) || 0

  function handleCardClick(e) {
    // No navegar si el click fue en un link o en un botón/menú interno.
    if (e.target.closest('a') || e.target.closest('button') || e.target.closest('.comment-menu-wrap')) return
    navigate(`/topic/${encodeURIComponent(contenido_id)}`)
  }

  const pinItems = [{
    label: topic.fijado ? 'Desanclar' : 'Fijar',
    icon: <PinIcon filled={topic.fijado} size={14} />,
    onClick: () => onTogglePin?.(topic),
  }]

  return (
    <div className="topic-card" onClick={handleCardClick}>
      {canPin && (
        <div className="topic-card-menu">
          <DropdownMenu items={pinItems} />
        </div>
      )}
      <UserAvatar
        url_imagen={autor.url_imagen}
        nickname={autor.nickname}
        size="md"
        inactive={autor.isInactive}
      />
      <div className="topic-body">
        {topic.fijado && (
          <div className="topic-pinned-badge">
            <PinIcon filled size={12} />
            Fijado
          </div>
        )}
        <div className="topic-head">
          {autor.isInactive ? (
            <span className="inactive-author">{autor.nickname}</span>
          ) : (
            <Link
              to={`/user/${encodeURIComponent(autor.nickname)}`}
              onClick={e => e.stopPropagation()}
            >
              {autor.nickname}
            </Link>
          )}
          <span>·</span>
          <span>{timeAgo(fecha_creacion)}</span>
        </div>

        <div className="topic-title">{titulo}</div>

        <div className="topic-preview">{cuerpo || ''}</div>

        <div className="topic-footer">
          <span className="topic-stat">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            {commentCount} {commentCount === 1 ? 'comentario' : 'comentarios'}
          </span>
        </div>
      </div>
    </div>
  )
}
