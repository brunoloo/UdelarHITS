import { Link } from 'react-router-dom'
import { Tag } from '../ui/Tag'
import { ReadMore } from '../ui/ReadMore'
import { UserAvatar } from './UserAvatar'
import { CategoryIcon } from './CategoryIcon'
import { resolveAutor } from './AuthorDisplay'
import { timeAgo } from '../../utils/timeAgo'
import { parseEtiquetas } from '../../utils/parseEtiquetas'
import { formatCount } from '../../utils/formatCount'
import './CategoryCard.css'
import './CommentCard.css' // reutilizamos los estilos de .comment-card

// Preview (solo visual) del último comentario directo a la categoría. Misma
// estructura que un CommentCard real (avatar + nickname/timeAgo, texto, footer
// con like y respuestas). No permite dar like ni responder.
function CommentPreview({ comment }) {
  const autor = resolveAutor(comment)
  const replyCount = Number(comment.contador_respuestas) || 0
  return (
    <div className="comment-card comment-card--clickable">
      <div className="comment-gutter">
        <UserAvatar
          url_imagen={autor.url_imagen}
          nickname={autor.nickname}
          size="md"
          inactive={autor.isInactive}
        />
      </div>
      <div className="comment-body">
        <div className="comment-body-top">
          <div className="comment-head">
            {autor.isInactive ? (
              <span className="inactive-author">{autor.nickname}</span>
            ) : (
              <span className="cat-preview-author">{autor.nickname}</span>
            )}
            <span>·</span>
            <span>{timeAgo(comment.fecha_creacion)}</span>
          </div>
        </div>

        <div className="comment-text">
          <ReadMore text={comment.cuerpo} maxLength={280} />
        </div>

        <div className="comment-actions">
          {/* Like (thumbs up, mismo SVG que ReactionButtons) — solo visual */}
          <span className="comment-action-info" title={`${comment.likes} me gusta`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
            </svg>
            {formatCount(comment.likes)}
          </span>
          {/* Respuestas */}
          <span className="comment-action-info">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            {replyCount}
          </span>
        </div>
      </div>
    </div>
  )
}

export function CategoryCard({ category }) {
  const {
    id,
    titulo,
    descripcion,
    etiquetas,
    contador_temas,
    ultimo_tema,
    ultimo_comentario,
    icono,
  } = category

  const tags = parseEtiquetas(etiquetas).slice(0, 3)
  const count = Number(contador_temas) || 0

  return (
    <div className="category-card">
      {/* Zona 2 (arriba): preview del último comentario → ?tab=comentarios */}
      {ultimo_comentario && (
        <Link
          className="category-comment-link"
          to={`/category/${encodeURIComponent(id)}?tab=comentarios`}
        >
          <CommentPreview comment={ultimo_comentario} />
        </Link>
      )}

      {/* Zona 1 (abajo): info de la categoría → /category/:id (tab Temas) */}
      <Link className="category-main" to={`/category/${encodeURIComponent(id)}`}>
        <div className="category-icon-wrap">
          <CategoryIcon name={icono} size={22} />
        </div>
        <div className="category-body">
          <div className="category-header-row">
            <div className="category-title">{titulo}</div>
            <div className="category-stats">{count} {count === 1 ? 'tema' : 'temas'}</div>
          </div>

          {descripcion && (
            <div className="category-description">
              <ReadMore text={descripcion} maxLength={500} />
            </div>
          )}

          {tags.length > 0 && (
            <div className="category-footer">
              {tags.map(tag => <Tag key={tag} label={tag} />)}
            </div>
          )}

          {ultimo_tema ? (
            <div className="last-activity">
              <span className="last-activity-label">Último tema:</span>
              <span className="last-activity-title">{ultimo_tema.titulo}</span>
              <span className="last-activity-meta">
                por {ultimo_tema.autor} · {timeAgo(ultimo_tema.fecha)}
              </span>
            </div>
          ) : (
            <div className="last-activity no-activity">
              Todavía no hay temas publicados
            </div>
          )}
        </div>
      </Link>
    </div>
  )
}
