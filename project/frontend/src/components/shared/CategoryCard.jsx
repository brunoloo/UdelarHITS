import { useNavigate } from 'react-router-dom'
import { Tag } from '../ui/Tag'
import { ReadMore } from '../ui/ReadMore'
import { UserAvatar } from './UserAvatar'
import { CategoryIcon } from './CategoryIcon'
import { PinIcon } from './PinIcon'
import { resolveAutor } from '../../utils/resolveAutor'
import { FacultyBadge } from './FacultyBadge'
import { CommentAttachments } from './CommentAttachments'
import { YouTubeEmbeds } from './YouTubeEmbeds'
import { PollDisplay } from './PollDisplay'
import { LikeIcon } from './LikeIcon'
import { timeAgo } from '../../utils/timeAgo'
import { parseEtiquetas } from '../../utils/parseEtiquetas'
import { formatCount } from '../../utils/formatCount'
import { categoryStats } from '../../utils/categoryStats'
import './CategoryCard.css'
import './CommentCard.css' // Reutiliza los estilos de .comment-card

// Preview solo visual del último comentario directo: no permite reaccionar ni responder.
function CommentPreview({ comment, priority = false }) {
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
          lazy
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
            <FacultyBadge facultad={autor.facultad} />
            <span>·</span>
            <span>{timeAgo(comment.fecha_creacion)}</span>
          </div>
        </div>

        {comment.cuerpo?.trim() && (
          <div className="comment-text">
            <ReadMore text={comment.cuerpo} maxLength={280} />
          </div>
        )}

        {/* El preview es siempre un comentario de primer nivel. */}
        <YouTubeEmbeds text={comment.cuerpo} />

        {/* En el feed el preview no supera los 500px; priority marca el primer adjunto como candidato a LCP. */}
        <CommentAttachments adjuntos={comment.adjuntos} maxWidth={600} priority={priority} />

        {comment.encuesta && <PollDisplay encuesta={comment.encuesta} readOnly />}

        <div className="comment-actions">
          <span className="comment-action-info" title={`${comment.likes} me gusta`}>
            <LikeIcon size={14} />
            {formatCount(comment.likes)}
          </span>
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

export function CategoryCard({ category, priority = false }) {
  const {
    id,
    titulo,
    descripcion,
    etiquetas,
    contador_temas,
    contador_comentarios,
    ultimo_tema,
    ultimo_comentario,
    icono,
    fijada,
  } = category

  const allTags = parseEtiquetas(etiquetas)
  const visibleTags = allTags.slice(0, 5)
  const extraCount = allTags.length - 5
  const stats = categoryStats(contador_temas, contador_comentarios)
  const catUrl = `/category/${encodeURIComponent(id)}`
  const navigate = useNavigate()
  // Sin temas, el preview del comentario ya cuenta la última actividad.
  const showEmptyHint = !ultimo_tema && !ultimo_comentario
  const hasFoot = visibleTags.length > 0 || !!ultimo_tema || showEmptyHint

  // <div> con onClick en vez de <Link>, para no anidar <a> dentro de <a>: la descripción y el preview ya linkean URLs.
  const goTo = (url) => (e) => {
    if (e.target.closest('a')) return
    navigate(url)
  }

  return (
    <div className="category-card">
      <div className="category-head-link" onClick={goTo(catUrl)}>
        {fijada && (
          <div className="category-pinned-badge">
            <PinIcon filled size={12} />
            Fijada
          </div>
        )}
        <div className="category-header-row">
          <div className="category-icon-wrap">
            <CategoryIcon name={icono} size={20} />
          </div>
          <div className="category-title">{titulo}</div>
          {stats && <div className="category-stats">{stats}</div>}
        </div>
        {descripcion && (
          <div className="category-description">
            <ReadMore text={descripcion} maxLength={500} />
          </div>
        )}
      </div>

      {ultimo_comentario && (
        <div className="category-comment-link" onClick={goTo(`${catUrl}?tab=comentarios`)}>
          <CommentPreview comment={ultimo_comentario} priority={priority} />
        </div>
      )}

      {hasFoot && <div className="category-foot-link" onClick={goTo(catUrl)}>
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
        ) : showEmptyHint && (
          <div className="last-activity no-activity">
            Todavía sin publicaciones. ¡Sé el primero en comentar!
          </div>
        )}
      </div>}
    </div>
  )
}
