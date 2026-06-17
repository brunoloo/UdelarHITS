import { Link } from 'react-router-dom'
import { Tag } from '../ui/Tag'
import { timeAgo } from '../../utils/timeAgo'
import { parseEtiquetas } from '../../utils/parseEtiquetas'
import './CategoryCard.css'

export function CategoryCard({ category }) {
  const {
    id,
    titulo,
    descripcion,
    etiquetas,
    contador_temas,
    ultimo_tema,
  } = category

  const tags = parseEtiquetas(etiquetas).slice(0, 3)
  const count = Number(contador_temas) || 0

  return (
    <Link className="category-card" to={`/category/${encodeURIComponent(id)}`}>
      <div className="category-body">
        <div className="category-header-row">
          <div className="category-title">{titulo}</div>
          <div className="category-stats">{count} {count === 1 ? 'tema' : 'temas'}</div>
        </div>

        {descripcion && (
          <div className="category-description">{descripcion}</div>
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
  )
}
