import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'
import { parseEtiquetas } from '../../utils/parseEtiquetas'
import './feed.css'
import './popular.css'

function Skeleton() {
  return (
    <div className="skeleton-card" style={{ display: 'flex', gap: 16 }}>
      <div className="skeleton" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton" style={{ height: 13, width: '50%', marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 11, width: '80%', marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 11, width: '35%' }} />
      </div>
    </div>
  )
}

function PopularCard({ category, rank }) {
  const etiquetas = parseEtiquetas(category.etiquetas).slice(0, 3)
  const count = Number(category.contador_temas) || 0
  const temasRecientes = Number(category.temas_recientes) || 0
  const comentariosRecientes = Number(category.comentarios_recientes) || 0

  return (
    <Link className="popular-card" to={`/category/${encodeURIComponent(category.id)}`}>
      <div className="popular-rank">{rank}</div>
      <div className="popular-body">
        <div className="popular-header-row">
          <div className="popular-card-title">{category.titulo}</div>
          <div className="popular-card-stats">{count} {count === 1 ? 'tema' : 'temas'}</div>
        </div>
        {category.descripcion && <div className="popular-desc">{category.descripcion}</div>}
        <div className="popular-footer">
          <div className="popular-activity">
            <span className="popular-activity-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                <polyline points="17 6 23 6 23 12"/>
              </svg>
              {temasRecientes} {temasRecientes === 1 ? 'tema' : 'temas'} · {comentariosRecientes} {comentariosRecientes === 1 ? 'comentario' : 'comentarios'} esta semana
            </span>
          </div>
          {etiquetas.length > 0 && (
            <div className="popular-tags">
              {etiquetas.map(e => <span key={e} className="tag">{e}</span>)}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

export function PopularPage() {
  const { data: popular = [], isLoading } = useQuery({
    queryKey: ['categories', 'popular'],
    queryFn: () => apiGet('/categories/popular?days=7&limit=20').then(r => r.data),
  })

  return (
    <div className="popular-page">
      <h1 className="popular-title">Populares</h1>
      <p className="popular-subtitle">Las categorías con más actividad en los últimos 7 días</p>

      {isLoading ? (
        Array.from({ length: 5 }, (_, i) => <Skeleton key={i} />)
      ) : popular.length === 0 ? (
        <div className="feed-empty">No hubo actividad esta semana. ¡Sé el primero en participar!</div>
      ) : (
        popular.map((c, i) => <PopularCard key={c.id} category={c} rank={i + 1} />)
      )}
    </div>
  )
}
