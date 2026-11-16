import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiDelete } from '../../api/client'
import { HOME_FEED_KEY, COMMUNITY_STATS_KEY } from '../../api/queryKeys'
import { commentPermalink } from '../../utils/commentPermalink'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { useToast } from '../../hooks/useToast'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-UY', { year: 'numeric', month: 'short', day: 'numeric' })
}

function TableSkeleton({ cols = 5 }) {
  return (
    <div className="admin-skeleton">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="admin-skeleton-row">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="skeleton" style={{ height: 14, flex: 1 }} />
          ))}
        </div>
      ))}
    </div>
  )
}

function CategoriesTab() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [estadoFilter, setEstadoFilter] = useState('todos')
  const [confirm, setConfirm] = useState(null)

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: () => apiGet('/categories/').then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: id => apiDelete(`/categories/${id}/delete`),
    onSuccess: () => {
      showToast('Categoría eliminada', 'success')
      queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
    },
    onError: err => showToast(err.message || 'Error al eliminar categoría', 'error'),
  })

  const filtered = categories.filter(c =>
    estadoFilter === 'todos' || c.estado === estadoFilter
  )

  return (
    <div>
      <div className="admin-filters">
        <select
          className="admin-select"
          value={estadoFilter}
          onChange={e => setEstadoFilter(e.target.value)}
        >
          <option value="todos">Todos los estados</option>
          <option value="activa">Activas</option>
          <option value="inactiva">Inactivas</option>
        </select>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <div className="admin-empty">No se encontraron categorías.</div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Autor</th>
                <th>Estado</th>
                <th>Creada</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id}>
                  <td data-label="Título">{c.titulo}</td>
                  <td data-label="Autor" className="admin-nick">@{c.autor_nickname}</td>
                  <td data-label="Estado">
                    <span className={`admin-status admin-status--${c.estado}`}>{c.estado}</span>
                  </td>
                  <td data-label="Creada">{formatDate(c.fecha_creacion)}</td>
                  <td>
                    <div className="admin-actions-cell">
                      <Link
                        to={`/category/${c.id}`}
                        className="admin-btn admin-btn--ghost"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver
                      </Link>
                      <button
                        className="admin-btn admin-btn--danger"
                        onClick={() => setConfirm(c)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => deleteMutation.mutate(confirm.id)}
        title="¿Eliminar categoría?"
        message={`¿Eliminar "${confirm?.titulo}"? Esta acción es irreversible.`}
        confirmText="Eliminar"
        danger
      />
    </div>
  )
}

function TopicsTab() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [estadoFilter, setEstadoFilter] = useState('todos')
  const [confirm, setConfirm] = useState(null)

  const { data: topics = [], isLoading } = useQuery({
    queryKey: ['admin', 'topics'],
    queryFn: () => apiGet('/topics/').then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: id => apiDelete(`/topics/${id}/delete`),
    onSuccess: () => {
      showToast('Tema eliminado', 'success')
      queryClient.invalidateQueries({ queryKey: ['admin', 'topics'] })
    },
    onError: err => showToast(err.message || 'Error al eliminar tema', 'error'),
  })

  const filtered = topics.filter(t =>
    estadoFilter === 'todos' || t.estado === estadoFilter
  )

  return (
    <div>
      <div className="admin-filters">
        <select
          className="admin-select"
          value={estadoFilter}
          onChange={e => setEstadoFilter(e.target.value)}
        >
          <option value="todos">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <div className="admin-empty">No se encontraron temas.</div>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Título</th>
                <th>Autor</th>
                <th>Estado</th>
                <th>Creado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id}>
                  <td data-label="Título">{t.titulo}</td>
                  <td data-label="Autor" className="admin-nick">@{t.autor_nickname}</td>
                  <td data-label="Estado">
                    <span className={`admin-status admin-status--${t.estado}`}>{t.estado}</span>
                  </td>
                  <td data-label="Creado">{formatDate(t.fecha_creacion)}</td>
                  <td>
                    <div className="admin-actions-cell">
                      <Link
                        to={`/topic/${t.id}`}
                        className="admin-btn admin-btn--ghost"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver
                      </Link>
                      <button
                        className="admin-btn admin-btn--danger"
                        onClick={() => setConfirm(t)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => deleteMutation.mutate(confirm.id)}
        title="¿Eliminar tema?"
        message={`¿Eliminar "${confirm?.titulo}"? Esta acción es irreversible.`}
        confirmText="Eliminar"
        danger
      />
    </div>
  )
}

const COMMENTS_PAGE = 30

const dondeEsta = (c) => {
  if (c.tipo === 'home') return 'Inicio'
  const prefijo = c.tipo === 'tema' ? 'Tema' : 'Categoría'
  return c.destino_titulo ? `${prefijo}: ${c.destino_titulo}` : prefijo
}

// Los adjuntos y la encuesta no se cargan en el listado: solo se avisa que están.
const extrasDe = (c) => [
  c.es_respuesta ? 'respuesta' : null,
  c.adjuntos > 0 ? `${c.adjuntos} ${c.adjuntos === 1 ? 'adjunto' : 'adjuntos'}` : null,
  c.tiene_encuesta ? 'encuesta' : null,
].filter(Boolean).join(' · ')

function CommentsTab() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const [estado, setEstado] = useState('todos')
  // La búsqueda se aplica al enviar el formulario, no en cada tecla.
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [confirm, setConfirm] = useState(null)

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['admin', 'comments', { estado, q }],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(COMMENTS_PAGE), offset: String(pageParam) })
      if (estado !== 'todos') params.set('estado', estado)
      if (q) params.set('q', q)
      return apiGet(`/admin/comments?${params.toString()}`).then(r => r.data)
    },
    initialPageParam: 0,
    getNextPageParam: last => {
      const next = last.offset + last.items.length
      return next < last.total ? next : undefined
    },
  })

  const deleteMutation = useMutation({
    mutationFn: id => apiDelete(`/replies/delete/${id}`),
    onSuccess: () => {
      showToast('Comentario eliminado', 'success')
      queryClient.invalidateQueries({ queryKey: ['admin', 'comments'] })
      queryClient.invalidateQueries({ queryKey: ['replies'] })
      queryClient.invalidateQueries({ queryKey: HOME_FEED_KEY })
      queryClient.invalidateQueries({ queryKey: COMMUNITY_STATS_KEY })
    },
    onError: err => showToast(err.message || 'Error al eliminar el comentario', 'error'),
  })

  const items = (data?.pages ?? []).flatMap(p => p.items)
  const total = data?.pages?.[0]?.total ?? 0

  return (
    <div>
      <form
        className="admin-filters"
        onSubmit={e => { e.preventDefault(); setQ(search.trim()) }}
      >
        <input
          className="admin-search"
          type="search"
          placeholder="Buscar por texto o autor"
          aria-label="Buscar comentarios"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="admin-btn admin-btn--ghost" type="submit">Buscar</button>
        <select
          className="admin-select"
          aria-label="Estado"
          value={estado}
          onChange={e => setEstado(e.target.value)}
        >
          <option value="todos">Todos los estados</option>
          <option value="visible">Visibles</option>
          <option value="oculto">Ocultos</option>
        </select>
        {!isLoading && (
          <span className="admin-count">
            <strong>{total}</strong> {total === 1 ? 'comentario' : 'comentarios'}
          </span>
        )}
      </form>

      {isLoading ? (
        <TableSkeleton />
      ) : items.length === 0 ? (
        <div className="admin-empty">No se encontraron comentarios.</div>
      ) : (
        <>
          <div className="admin-table-wrapper">
            <table className="admin-table admin-table--comments">
              <thead>
                <tr>
                  <th>Comentario</th>
                  <th>Autor</th>
                  <th>Dónde</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map(c => {
                  const extras = extrasDe(c)
                  return (
                    <tr key={c.id}>
                      <td data-label="Comentario" className="admin-comment-cell">
                        <div className="admin-comment-text">{c.cuerpo?.trim() || '(sin texto)'}</div>
                        {extras && <div className="admin-comment-extras">{extras}</div>}
                      </td>
                      <td data-label="Autor" className="admin-nick">@{c.autor_nickname}</td>
                      <td data-label="Dónde">{dondeEsta(c)}</td>
                      <td data-label="Estado">
                        <span className={`admin-status admin-status--${c.estado}`}>{c.estado}</span>
                      </td>
                      <td data-label="Fecha">{formatDate(c.fecha_creacion)}</td>
                      <td>
                        <div className="admin-actions-cell">
                          <Link
                            to={commentPermalink({ tipo: c.tipo, id: c.id, destino_id: c.destino_id })}
                            className="admin-btn admin-btn--ghost"
                            target="_blank"
                            rel="noreferrer"
                          >
                            Ver
                          </Link>
                          {c.estado === 'visible' && (
                            <button
                              className="admin-btn admin-btn--danger"
                              onClick={() => setConfirm(c)}
                            >
                              Eliminar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {hasNextPage && (
            <div className="admin-more">
              <button
                className="admin-btn admin-btn--ghost"
                type="button"
                disabled={isFetchingNextPage}
                onClick={() => fetchNextPage()}
              >
                {isFetchingNextPage ? 'Cargando...' : 'Cargar más'}
              </button>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => deleteMutation.mutate(confirm.id)}
        title="¿Eliminar comentario?"
        message={`¿Eliminar el comentario de @${confirm?.autor_nickname}? Si tiene respuestas queda oculto; si no, se borra de forma irreversible.`}
        confirmText="Eliminar"
        danger
      />
    </div>
  )
}

const SUBTABS = [
  { key: 'categorias', label: 'Categorías', Tab: CategoriesTab },
  { key: 'temas', label: 'Temas', Tab: TopicsTab },
  { key: 'comentarios', label: 'Comentarios', Tab: CommentsTab },
]

export function ContentSection() {
  const [subTab, setSubTab] = useState('categorias')
  const ActiveTab = SUBTABS.find(t => t.key === subTab).Tab

  return (
    <div className="admin-section">
      <div className="admin-subtabs">
        {SUBTABS.map(({ key, label }) => (
          <button
            key={key}
            className={`admin-subtab${subTab === key ? ' active' : ''}`}
            onClick={() => setSubTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <ActiveTab />
    </div>
  )
}
