import { Link } from 'react-router-dom'
import { Tag } from '../ui/Tag'
import { CategoryIcon } from './CategoryIcon'
import { SearchSnippet } from './SearchSnippet'
import { parseEtiquetas } from '../../utils/parseEtiquetas'
import { categoryPath } from '../../utils/slug'
import './CategoryCardMini.css'

// Versión reducida de CategoryCard. `snippet` reemplaza la descripción por el fragmento
// resaltado en resultados de búsqueda.
export function CategoryCardMini({ category, className = '', onNavigate, snippet = null }) {
  const { id, titulo, descripcion, etiquetas, contador_temas, contador_comentarios, icono } = category
  const allTags = parseEtiquetas(etiquetas)
  const visibleTags = allTags.slice(0, 5)
  const extraCount = allTags.length - 5
  const count = Number(contador_temas) || 0
  // El contador de comentarios se muestra solo si la fuente lo trae.
  const hasComments = contador_comentarios != null
  const commentCount = Number(contador_comentarios) || 0

  return (
    <Link
      className={`category-mini-card${className ? ' ' + className : ''}`}
      to={categoryPath(id, titulo)}
      onClick={onNavigate}
    >
      <div className="category-mini-head">
        <div className="category-mini-icon">
          <CategoryIcon name={icono} size={18} />
        </div>
        <div className="category-mini-title">{titulo}</div>
      </div>

      {snippet?.match
        ? <div className="category-mini-desc"><SearchSnippet before={snippet.before} match={snippet.match} after={snippet.after} /></div>
        : descripcion && <div className="category-mini-desc">{descripcion}</div>}

      <div className="category-mini-foot">
        <span className="category-mini-count">
          {count} {count === 1 ? 'tema' : 'temas'}
          {hasComments && `${' · '}${commentCount} ${commentCount === 1 ? 'comentario' : 'comentarios'}`}
        </span>
        {visibleTags.length > 0 && (
          <div className="category-mini-tags">
            {visibleTags.map(t => <Tag key={t} label={t} />)}
            {extraCount > 0 && <span className="tag tag--more">+{extraCount} más</span>}
          </div>
        )}
      </div>
    </Link>
  )
}
