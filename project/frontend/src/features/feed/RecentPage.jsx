import { Fragment, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'
import { TopicCard } from '../../components/shared/TopicCard'
import { CommentEntry } from '../../components/shared/CommentEntry'
import { parseEtiquetas } from '../../utils/parseEtiquetas'
import { useQuickReply } from '../../hooks/useQuickReply'
import { useLastVisit } from '../../hooks/useLastVisit'
import { Tag } from '../../components/ui/Tag'
import { timeAgo } from '../../utils/timeAgo'
import { categoryStats } from '../../utils/categoryStats'
import { EmptyState } from '../../components/ui/EmptyState'
import './feed.css'
import './recent.css'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

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
  const allEtiquetas = parseEtiquetas(category.etiquetas)
  const etiquetas = allEtiquetas.slice(0, 5)
  const extraCount = allEtiquetas.length - 5
  const stats = categoryStats(category.contador_temas, category.contador_comentarios)
  // Cuenta inactiva: se anonimiza; las baneadas siguen públicas.
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
        {stats && <span className="recent-cat-count">{stats}</span>}
      </div>
      <div className="recent-cat-title">{category.titulo}</div>
      {category.descripcion && <div className="recent-cat-desc">{category.descripcion}</div>}
      {etiquetas.length > 0 && (
        <div className="recent-cat-footer">
          <div className="recent-cat-tags">
            {etiquetas.map(e => <Tag key={e} label={e} />)}
            {extraCount > 0 && <span className="tag tag--more">+{extraCount} más</span>}
          </div>
        </div>
      )}
    </Link>
  )
}

const TABS = [
  { key: 'todos', label: 'Todos' },
  { key: 'temas', label: 'Temas' },
  { key: 'categorias', label: 'Categorías' },
  { key: 'comentarios', label: 'Comentarios' },
  { key: 'sin_respuesta', label: 'Sin respuesta' },
]

const itemKey = (item, i) => {
  const prefix = item.type === 'tema' ? 't' : item.type === 'categoria' ? 'c' : 'm'
  return `${prefix}-${item.data.id || item.data.contenido_id || i}`
}

const EMPTY = {
  todos: { message: 'Todavía no hay publicaciones.', to: '/explore', label: 'Explorar categorías' },
  temas: { message: 'Todavía no hay temas. Se crean dentro de una categoría.', to: '/explore', label: 'Elegir una categoría' },
  categorias: { message: 'Todavía no hay categorías.', to: '/', label: 'Ir al inicio' },
  comentarios: { message: 'Todavía no hay comentarios.', to: '/', label: 'Escribir el primero' },
  sin_respuesta: { message: 'No hay comentarios esperando respuesta.', to: '/', label: 'Ir al inicio' },
}

export function RecentPage() {
  useDocumentTitle()
  // ?tab= permite enlazar una pestaña desde otra pantalla (p. ej. Explorar).
  const [searchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const [tab, setTab] = useState(TABS.some(t => t.key === tabParam) ? tabParam : 'todos')
  const sinRespuesta = tab === 'sin_respuesta'

  const handleReply = useQuickReply(['replies', 'recent'])
  const lastVisit = useLastVisit('recent')

  const { data: topics = [], isLoading: loadingTopics } = useQuery({
    queryKey: ['topics', 'recent'],
    queryFn: () => apiGet('/topics/recent?limit=30').then(r => r.data),
  })

  // Alcanza con el índice liviano.
  const { data: categories = [], isLoading: loadingCats } = useQuery({
    queryKey: ['categories', 'index'],
    queryFn: () => apiGet('/categories/index').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const { data: comments = [], isLoading: loadingComments } = useQuery({
    queryKey: ['replies', 'recent'],
    queryFn: () => apiGet('/replies/recent?limit=30').then(r => r.data),
  })

  const { data: unanswered = [], isLoading: loadingUnanswered } = useQuery({
    queryKey: ['replies', 'recent', 'sin_respuesta'],
    queryFn: () => apiGet('/replies/recent?sin_respuesta=1&limit=30').then(r => r.data),
    enabled: sinRespuesta,
  })

  const isLoading = sinRespuesta
    ? loadingUnanswered
    : loadingTopics || loadingCats || loadingComments

  const items = (() => {
    const list = []
    if (tab === 'todos' || tab === 'temas') {
      topics.forEach(t => list.push({ type: 'tema', data: { ...t, contenido_id: t.contenido_id ?? t.id }, date: new Date(t.fecha_creacion) }))
    }
    if (tab === 'todos' || tab === 'categorias') {
      categories.forEach(c => list.push({ type: 'categoria', data: c, date: new Date(c.fecha_creacion) }))
    }
    if (tab === 'todos' || tab === 'comentarios') {
      comments.forEach(c => list.push({ type: 'comentario', data: c, date: new Date(c.fecha_creacion) }))
    }
    if (sinRespuesta) {
      unanswered.forEach(c => list.push({ type: 'comentario', data: c, date: new Date(c.fecha_creacion) }))
    }
    return list.sort((a, b) => b.date - a.date)
  })()

  // Sin visita previa en este navegador no hay nada que marcar.
  const newCount = lastVisit == null ? 0 : items.filter(item => item.date.getTime() > lastVisit).length

  return (
    <div className="recent-page">
      <h1 className="recent-title">Recientes</h1>
      <p className="recent-subtitle">Lo último que se publicó en la comunidad</p>

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

      {!isLoading && newCount > 0 && (
        <p className="recent-new-note">
          {newCount} {newCount === 1 ? 'publicación nueva' : 'publicaciones nuevas'} desde tu última visita
        </p>
      )}

      {isLoading ? (
        Array.from({ length: 5 }, (_, i) => <Skeleton key={i} />)
      ) : items.length === 0 ? (
        <EmptyState className="feed-empty" {...EMPTY[tab]} />
      ) : (
        items.map((item, i) => (
          <Fragment key={itemKey(item, i)}>
            {/* La lista va de lo más nuevo a lo más viejo: el corte marca dónde empieza lo ya visto. */}
            {i === newCount && newCount > 0 && (
              <div className="recent-seen-divider" role="separator">Ya lo viste</div>
            )}
            {item.type === 'tema' ? (
              <TopicCard topic={item.data} />
            ) : item.type === 'categoria' ? (
              <RecentCategoryCard category={item.data} />
            ) : (
              <CommentEntry
                comment={item.data}
                invalidateKey={['replies', 'recent']}
                onReply={handleReply}
                embedVideos
              />
            )}
          </Fragment>
        ))
      )}
    </div>
  )
}
