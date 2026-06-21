import { useNavigate, Link } from 'react-router-dom'
import { resolveAutor } from './AuthorDisplay'
import { UserAvatar } from './UserAvatar'
import { timeAgo } from '../../utils/timeAgo'
import './TopicCard.css'

export function TopicCard({ topic }) {
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
    // Don't navigate if the click was on an inner link (author name)
    if (e.target.closest('a')) return
    navigate(`/topic/${encodeURIComponent(contenido_id)}`)
  }

  return (
    <div className="topic-card" onClick={handleCardClick}>
      <UserAvatar
        url_imagen={autor.url_imagen}
        nickname={autor.nickname}
        size="md"
        inactive={autor.isInactive}
      />
      <div className="topic-body">
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
