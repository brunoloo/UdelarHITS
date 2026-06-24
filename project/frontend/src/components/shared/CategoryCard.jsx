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

// Preview (solo visual) del último comentario directo a la categoría. No permite
// dar like ni responder; al clickear navega al tab de comentarios (en el padre).
function CommentPreview({ comment }) {
  const autor = resolveAutor(comment)
  return (
    <div className="cat-comment-preview-card">
      <div className="cat-comment-preview-head">
        <UserAvatar
          url_imagen={autor.url_imagen}
          nickname={autor.nickname}
          size="sm"
          inactive={autor.isInactive}
        />
        <span className={`cat-comment-preview-author${autor.isInactive ? ' inactive' : ''}`}>
          {autor.nickname}
        </span>
        <span className="cat-comment-preview-time">· {timeAgo(comment.fecha_creacion)}</span>
      </div>
      <div className="cat-comment-preview-body">
        <ReadMore text={comment.cuerpo} maxLength={280} />
      </div>
      <div className="cat-comment-preview-likes" title={`${comment.likes} me gusta`}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        {formatCount(comment.likes)}
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
      {/* Zona 1: info de la categoría → /category/:id (tab Temas) */}
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

      {/* Zona 2: preview del último comentario → /category/:id?tab=comentarios */}
      {ultimo_comentario && (
        <Link
          className="category-comment-preview"
          to={`/category/${encodeURIComponent(id)}?tab=comentarios`}
        >
          <span className="cat-comment-preview-label">Último comentario</span>
          <CommentPreview comment={ultimo_comentario} />
        </Link>
      )}
    </div>
  )
}
