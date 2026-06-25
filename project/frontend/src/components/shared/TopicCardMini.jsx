import { useNavigate } from 'react-router-dom'
import './TopicCardMini.css'

// Versión reducida de la TopicCard: título + descripción + cantidad de
// comentarios. Sin autor ni avatar (el contexto de quién lo publicó lo da el
// listado, p. ej. el perfil). Al clickear lleva al tema.
export function TopicCardMini({ topic }) {
  const navigate = useNavigate()
  const id = topic.id ?? topic.contenido_id
  const count = Number(topic.contador_comentarios) || 0

  return (
    <div
      className="topic-mini-card"
      onClick={() => navigate(`/topic/${encodeURIComponent(id)}`)}
    >
      <div className="topic-mini-title">{topic.titulo}</div>

      {topic.cuerpo && <div className="topic-mini-desc">{topic.cuerpo}</div>}

      <div className="topic-mini-foot">
        <span className="topic-mini-stat">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          {count} {count === 1 ? 'comentario' : 'comentarios'}
        </span>
      </div>
    </div>
  )
}
