import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'
import { parseEtiquetas } from '../../utils/parseEtiquetas'
import { Tag } from '../../components/ui/Tag'
import { categoryStats } from '../../utils/categoryStats'
import { ventanaTexto, ventanaSubtitulo } from '../../utils/ventana'
import './feed.css'
import './popular.css'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

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

function PopularCard({ category, rank, ventanaDias }) {
  const allEtiquetas = parseEtiquetas(category.etiquetas)
  const etiquetas = allEtiquetas.slice(0, 5)
  const extraCount = allEtiquetas.length - 5
  const stats = categoryStats(category.contador_temas, category.contador_comentarios)
  // Solo comentarios de primer nivel directos a la categoría. En el histórico
  // repetiría los totales de arriba.
  const recientes = ventanaDias == null
    ? ''
    : categoryStats(category.temas_recientes, category.comentarios_directos_recientes)

  return (
    <Link className="popular-card" to={`/category/${encodeURIComponent(category.id)}`}>
      <div className="popular-rank">{rank}</div>
      <div className="popular-body">
        <div className="popular-header-row">
          <div className="popular-card-title">{category.titulo}</div>
          {stats && <div className="popular-card-stats">{stats}</div>}
        </div>
        {category.descripcion && <div className="popular-desc">{category.descripcion}</div>}
        <div className="popular-footer">
          {recientes && (
            <div className="popular-activity">
              <span className="popular-activity-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                  <polyline points="17 6 23 6 23 12"/>
                </svg>
                {recientes} {ventanaTexto(ventanaDias)}
              </span>
            </div>
          )}
          {etiquetas.length > 0 && (
            <div className="popular-tags">
              {etiquetas.map(e => <Tag key={e} label={e} />)}
              {extraCount > 0 && <span className="tag tag--more">+{extraCount} más</span>}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

export function PopularPage() {
  useDocumentTitle()
  // La key incluye los parámetros: Explorar usa el mismo endpoint con otro límite.
  // Sin `days`: el backend amplía la ventana si la semana no alcanza y dice cuál usó.
  const { data, isLoading } = useQuery({
    queryKey: ['categories', 'popular', { limit: 20 }],
    queryFn: () => apiGet('/categories/popular?limit=20')
      .then(r => ({ items: r.data, ventanaDias: r.ventana_dias ?? null })),
    staleTime: 2 * 60 * 1000,
  })
  const popular = data?.items ?? []
  const ventanaDias = data?.ventanaDias ?? null

  return (
    <div className="popular-page">
      <h1 className="popular-title">Populares</h1>
      <p className="popular-subtitle">{ventanaSubtitulo(isLoading ? 7 : ventanaDias)}</p>

      {isLoading ? (
        Array.from({ length: 5 }, (_, i) => <Skeleton key={i} />)
      ) : popular.length === 0 ? (
        <div className="feed-empty">
          <p className="feed-empty-msg">Todavía no hay actividad en las categorías.</p>
          <Link className="feed-empty-cta" to="/explore">Explorar categorías</Link>
        </div>
      ) : (
        popular.map((c, i) => <PopularCard key={c.id} category={c} rank={i + 1} ventanaDias={ventanaDias} />)
      )}
    </div>
  )
}
