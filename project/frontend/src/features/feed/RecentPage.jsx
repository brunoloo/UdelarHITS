import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'
import { TopicCard } from '../../components/shared/TopicCard'
import { parseEtiquetas } from '../../utils/parseEtiquetas'
import { timeAgo } from '../../utils/timeAgo'
import './feed.css'
import './recent.css'

function Skeleton() {
  return (
    <div className="skeleton-card" style={{ display: 'flex', gap: 12 }}>
      <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div className="skeleton" style={{ height: 11, width: '40%', marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 15, width: '70%', marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 11, width: '55%' }} />
      </div>
    </div>
  )
}

function RecentCategoryCard({ category }) {
  const etiquetas = parseEtiquetas(category.etiquetas).slice(0, 3)
  const count = Number(category.contador_temas) || 0
  // Cuenta inactiva → se anonimiza. (Las cuentas 'ban' siguen siendo públicas.)
  const author = category.autor_estado === 'inactivo'
    ? 'Usuario inactivo'
    : (category.autor_nickname || category.autor || '')
  return (
    <Link className="recent-cat-card" to={`/category/${encodeURIComponent(category.id)}`}>
      <div className="recent-cat-header">
        <span className="recent-type-badge recent-type-badge--cat">Categoría</span>
        <span className="recent-cat-meta">
          {timeAgo(category.fecha_creacion)}{author ? ` · por ${author}` : ''}
        </span>
      </div>
      <div className="recent-cat-title">{category.titulo}</div>
      {category.descripcion && <div className="recent-cat-desc">{category.descripcion}</div>}
      <div className="recent-cat-footer">
        <span className="recent-cat-count">{count} {count === 1 ? 'tema' : 'temas'}</span>
        {etiquetas.length > 0 && (
          <div className="recent-cat-tags">
            {etiquetas.map(e => <span key={e} className="tag">{e}</span>)}
          </div>
        )}
      </div>
    </Link>
  )
}

const TABS = [
  { key: 'todos', label: 'Todos' },
  { key: 'temas', label: 'Temas' },
  { key: 'categorias', label: 'Categorías' },
]

export function RecentPage() {
  const [tab, setTab] = useState('todos')

  const { data: topics = [], isLoading: loadingTopics } = useQuery({
    queryKey: ['topics', 'recent'],
    queryFn: () => apiGet('/topics/recent?limit=30').then(r => r.data),
  })

  const { data: categories = [], isLoading: loadingCats } = useQuery({
    queryKey: ['categories', 'active'],
    queryFn: () => apiGet('/categories/active').then(r => r.data),
  })

  const isLoading = loadingTopics || loadingCats

  const items = (() => {
    const list = []
    if (tab === 'todos' || tab === 'temas') {
      topics.forEach(t => list.push({ type: 'tema', data: { ...t, contenido_id: t.contenido_id ?? t.id }, date: new Date(t.fecha_creacion) }))
    }
    if (tab === 'todos' || tab === 'categorias') {
      categories.forEach(c => list.push({ type: 'categoria', data: c, date: new Date(c.fecha_creacion) }))
    }
    return list.sort((a, b) => b.date - a.date)
  })()

  return (
    <div className="recent-page">
      <h1 className="recent-title">Recientes</h1>
      <p className="recent-subtitle">Los últimos temas y categorías publicadas en la comunidad</p>

      <div className="recent-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`recent-tab${tab === t.key ? ' active' : ''}`}
            type="button"
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        Array.from({ length: 5 }, (_, i) => <Skeleton key={i} />)
      ) : items.length === 0 ? (
        <div className="feed-empty">No hay contenido reciente todavía.</div>
      ) : (
        items.map((item, i) =>
          item.type === 'tema'
            ? <TopicCard key={item.data.id || item.data.contenido_id || i} topic={item.data} />
            : <RecentCategoryCard key={item.data.id || i} category={item.data} />
        )
      )}
    </div>
  )
}
