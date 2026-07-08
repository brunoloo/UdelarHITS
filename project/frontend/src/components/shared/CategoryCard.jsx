import { useNavigate } from 'react-router-dom'
import { Tag } from '../ui/Tag'
import { ReadMore } from '../ui/ReadMore'
import { UserAvatar } from './UserAvatar'
import { CategoryIcon } from './CategoryIcon'
import { resolveAutor } from './AuthorDisplay'
import { CommentAttachments } from './CommentAttachments'
import { PollDisplay } from './PollDisplay'
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

        {comment.cuerpo?.trim() && (
          <div className="comment-text">
            <ReadMore text={comment.cuerpo} maxLength={280} />
          </div>
        )}

        <CommentAttachments adjuntos={comment.adjuntos} />

        {comment.encuesta && <PollDisplay encuesta={comment.encuesta} readOnly />}

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
            {formatCount(replyCount)}
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

  const allTags = parseEtiquetas(etiquetas)
  const visibleTags = allTags.slice(0, 5)
  const extraCount = allTags.length - 5
  const count = Number(contador_temas) || 0
  const catUrl = `/category/${encodeURIComponent(id)}`
  const navigate = useNavigate()

  // Las zonas de la card navegan como un Link, pero usamos <div> + onClick para
  // no anidar <a> dentro de <a> (la descripción y el preview autolinkean URLs,
  // que ya son <a>). Un click sobre un link interno respeta ese link.
  const goTo = (url) => (e) => {
    if (e.target.closest('a')) return
    navigate(url)
  }

  return (
    <div className="category-card">
      {/* (1) Ícono + título + conteo + descripción → /category/:id */}
      <div className="category-head-link" onClick={goTo(catUrl)}>
        <div className="category-header-row">
          <div className="category-icon-wrap">
            <CategoryIcon name={icono} size={20} />
          </div>
          <div className="category-title">{titulo}</div>
          <div className="category-stats">{count} {count === 1 ? 'tema' : 'temas'}</div>
        </div>
        {descripcion && (
          <div className="category-description">
            <ReadMore text={descripcion} maxLength={500} />
          </div>
        )}
      </div>

      {/* (2) Preview del último comentario embebido → ?tab=comentarios */}
      {ultimo_comentario && (
        <div className="category-comment-link" onClick={goTo(`${catUrl}?tab=comentarios`)}>
          <CommentPreview comment={ultimo_comentario} />
        </div>
      )}

      {/* (3) Tags + (4) footer "Último tema" → /category/:id */}
      <div className="category-foot-link" onClick={goTo(catUrl)}>
        {visibleTags.length > 0 && (
          <div className="category-footer">
            {visibleTags.map(tag => <Tag key={tag} label={tag} />)}
            {extraCount > 0 && <span className="tag tag--more">+{extraCount} más</span>}
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
    </div>
  )
}
