import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '../../api/client'
import { TopicCard } from '../../components/shared/TopicCard'
import { CommentEntry } from '../../components/shared/CommentEntry'
import { parseEtiquetas } from '../../utils/parseEtiquetas'
import { buildReplyFormData } from '../../utils/attachments'
import { useToast } from '../../hooks/useToast'
import { Tag } from '../../components/ui/Tag'
import { timeAgo } from '../../utils/timeAgo'
import { categoryStats } from '../../utils/categoryStats'
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
]

export function RecentPage() {
  useDocumentTitle()
  const [tab, setTab] = useState('todos')
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  const replyMutation = useMutation({
    mutationFn: ({ parentId, cuerpo, files, poll }) =>
      apiPost('/replies/create', buildReplyFormData({ cuerpo, comentario_padre_id: parentId }, files, poll)),
    onSuccess: (res) => {
      if (res?.data?.advertencia) showToast(res.data.advertencia, 'error')
      else showToast('Respuesta publicada', 'success')
      queryClient.invalidateQueries({ queryKey: ['replies', 'recent'] })
    },
    onError: (err) => showToast(err.message || 'Error al publicar', 'error'),
  })

  const handleReply = (parentId, text, files, poll) =>
    replyMutation.mutateAsync({ parentId, cuerpo: text, files, poll })

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

  const isLoading = loadingTopics || loadingCats || loadingComments

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
        items.map((item, i) => {
          if (item.type === 'tema') {
            return <TopicCard key={`t-${item.data.id || item.data.contenido_id || i}`} topic={item.data} />
          }
          if (item.type === 'categoria') {
            return <RecentCategoryCard key={`c-${item.data.id || i}`} category={item.data} />
          }
          return (
            <CommentEntry
              key={`m-${item.data.id || i}`}
              comment={item.data}
              invalidateKey={['replies', 'recent']}
              onReply={handleReply}
              embedVideos
            />
          )
        })
      )}
    </div>
  )
}
