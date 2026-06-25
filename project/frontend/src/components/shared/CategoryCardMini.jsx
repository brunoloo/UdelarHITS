import { Link } from 'react-router-dom'
import { Tag } from '../ui/Tag'
import { CategoryIcon } from './CategoryIcon'
import { parseEtiquetas } from '../../utils/parseEtiquetas'
import './CategoryCardMini.css'

// Versión reducida de la CategoryCard: ícono + título + descripción + etiquetas
// + cantidad de temas. Se reutiliza en cada listado de categorías en forma
// compacta (perfil, explorar, etc.). La versión ampliada (Home) es CategoryCard.
// `className` permite variantes de contenedor (p. ej. ancho fijo en carrusel).
export function CategoryCardMini({ category, className = '', onNavigate }) {
  const { id, titulo, descripcion, etiquetas, contador_temas, icono } = category
  const tags = parseEtiquetas(etiquetas).slice(0, 3)
  const count = Number(contador_temas) || 0

  return (
    <Link
      className={`category-mini-card${className ? ' ' + className : ''}`}
      to={`/category/${encodeURIComponent(id)}`}
      onClick={onNavigate}
    >
      <div className="category-mini-head">
        <div className="category-mini-icon">
          <CategoryIcon name={icono} size={18} />
        </div>
        <div className="category-mini-title">{titulo}</div>
      </div>

      {descripcion && <div className="category-mini-desc">{descripcion}</div>}

      <div className="category-mini-foot">
        <span className="category-mini-count">
          {count} {count === 1 ? 'tema' : 'temas'}
        </span>
        {tags.length > 0 && (
          <div className="category-mini-tags">
            {tags.map(t => <Tag key={t} label={t} />)}
          </div>
        )}
      </div>
    </Link>
  )
}
