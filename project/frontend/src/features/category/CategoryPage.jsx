import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { apiGet, apiPost, apiPatch, apiDelete } from '../../api/client'
import { TopicCard } from '../../components/shared/TopicCard'
import { UserAvatar } from '../../components/shared/UserAvatar'
import { resolveAutor } from '../../components/shared/AuthorDisplay'
import { Modal } from '../../components/ui/Modal'
import { DropdownMenu } from '../../components/ui/DropdownMenu'
import { timeAgo } from '../../utils/timeAgo'
import { parseEtiquetas } from '../../utils/parseEtiquetas'
import { useToast } from '../../hooks/useToast'
import './category.css'

// ── SKELETONS ──────────────────────────────────────────────────────────────────
function TopicSkeleton() {
  return (
    <>
      <div className="skeleton-card">
        <div className="skeleton" style={{ height: 11, width: '28%', marginBottom: 10 }} />
        <div className="skeleton" style={{ height: 17, width: '65%', marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 12, width: '90%', marginBottom: 4 }} />
        <div className="skeleton" style={{ height: 12, width: '55%' }} />
      </div>
      <div className="skeleton-card">
        <div className="skeleton" style={{ height: 11, width: '22%', marginBottom: 10 }} />
        <div className="skeleton" style={{ height: 17, width: '50%', marginBottom: 8 }} />
        <div className="skeleton" style={{ height: 12, width: '80%', marginBottom: 4 }} />
        <div className="skeleton" style={{ height: 12, width: '45%' }} />
      </div>
    </>
  )
}

// ── COMMENT CARD ───────────────────────────────────────────────────────────────
function CommentCard({ comment }) {
  const autor = resolveAutor(comment)
  return (
    <div className="comment-card">
      <div className="comment-gutter">
        <UserAvatar
          url_imagen={autor.url_imagen}
          nickname={autor.nickname}
          size="md"
          inactive={autor.isInactive}
        />
      </div>
      <div className="comment-body">
        <div className="comment-head">
          {autor.isInactive ? (
            <span className="inactive-author">{autor.nickname}</span>
          ) : (
            <Link to={`/user/${encodeURIComponent(autor.nickname)}`}>{autor.nickname}</Link>
          )}
          <span>·</span>
          <span>{timeAgo(comment.fecha_creacion)}</span>
        </div>
        <div className="comment-text">{comment.cuerpo}</div>
      </div>
    </div>
  )
}

// ── CREATE TOPIC PANEL ─────────────────────────────────────────────────────────
function CreateTopicPanel({ categoryId, user }) {
  const [open, setOpen] = useState(false)
  const [titulo, setTitulo] = useState('')
  const [cuerpo, setCuerpo] = useState('')
  const { showToast } = useToast()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => apiPost('/topics/create', {
      titulo: titulo.trim(),
      cuerpo: cuerpo.trim(),
      categoria_id: categoryId,
    }),
    onSuccess: () => {
      showToast('Tema creado correctamente', 'success')
      setOpen(false)
      setTitulo('')
      setCuerpo('')
      queryClient.invalidateQueries({ queryKey: ['category', categoryId] })
    },
    onError: (err) => {
      showToast(err.message || 'Error al crear el tema', 'error')
    },
  })

  function closePanel() {
    setOpen(false)
    setTitulo('')
    setCuerpo('')
    mutation.reset()
  }

  const canSubmit = titulo.trim().length >= 3 && cuerpo.trim().length >= 1

  const avatarContent = user?.url_imagen ? (
    <img
      src={user.url_imagen}
      alt=""
      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
      onError={e => { e.currentTarget.style.display = 'none' }}
    />
  ) : null

  if (!open) {
    return (
      <section className="create-topic">
        <button className="create-topic-trigger" type="button" onClick={() => setOpen(true)}>
          <span className="ct-avatar" aria-hidden="true">{avatarContent}</span>
          <span className="ct-placeholder">Crear un nuevo tema</span>
          <span className="ct-cta">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Nuevo tema
          </span>
        </button>
      </section>
    )
  }

  return (
    <section className="create-topic">
      <div className="create-cat-panel open">
        <div className="create-cat-panel-body">
          <span className="ct-avatar" aria-hidden="true">{avatarContent}</span>
          <div className="cc-form">
            <div className="edit-field">
              <div className="edit-field-label">
                <span>Título (mínimo 3 caracteres*)</span>
                <span className="edit-field-counter">{titulo.length} / 100</span>
              </div>
              <input
                type="text"
                maxLength={100}
                placeholder="¿De qué querés hablar?"
                value={titulo}
                onChange={e => setTitulo(e.target.value)}
                autoFocus
              />
            </div>
            <div className="edit-field">
              <div className="edit-field-label">
                <span>Contenido (*)</span>
                <span className="edit-field-counter">{cuerpo.length} / 750</span>
              </div>
              <textarea
                maxLength={750}
                rows={4}
                placeholder="Desarrollá tu idea"
                value={cuerpo}
                onChange={e => setCuerpo(e.target.value)}
              />
            </div>
          </div>
        </div>
        <div className="create-cat-panel-footer">
          <button className="cc-cancel" type="button" onClick={closePanel}>Cancelar</button>
          <button
            className="save-btn"
            type="button"
            disabled={!canSubmit || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Creando...' : 'Crear tema'}
          </button>
        </div>
      </div>
    </section>
  )
}

// ── CREATE COMMENT PANEL ───────────────────────────────────────────────────────
function CreateCommentPanel({ categoryId, user }) {
  const [open, setOpen] = useState(false)
  const [cuerpo, setCuerpo] = useState('')
  const { showToast } = useToast()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: () => apiPost('/replies/create', {
      cuerpo: cuerpo.trim(),
      categoria_id: categoryId,
    }),
    onSuccess: () => {
      showToast('Comentario publicado', 'success')
      setOpen(false)
      setCuerpo('')
      queryClient.invalidateQueries({ queryKey: ['replies', 'category', categoryId] })
    },
    onError: (err) => {
      showToast(err.message || 'Error al publicar', 'error')
    },
  })

  function closePanel() {
    setOpen(false)
    setCuerpo('')
    mutation.reset()
  }

  const canSubmit = cuerpo.trim().length >= 1

  const avatarContent = user?.url_imagen ? (
    <img
      src={user.url_imagen}
      alt=""
      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
      onError={e => { e.currentTarget.style.display = 'none' }}
    />
  ) : null

  if (!open) {
    return (
      <section className="create-topic">
        <button className="create-topic-trigger" type="button" onClick={() => setOpen(true)}>
          <span className="ct-avatar ct-avatar-comment" aria-hidden="true">{avatarContent}</span>
          <span className="ct-placeholder">Publicar comentario</span>
          <span className="ct-cta">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            Comentar
          </span>
        </button>
      </section>
    )
  }

  return (
    <section className="create-topic">
      <div className="create-cat-panel open">
        <div className="create-cat-panel-body">
          <span className="ct-avatar ct-avatar-comment" aria-hidden="true">{avatarContent}</span>
          <div className="cc-form">
            <div className="edit-field">
              <div className="edit-field-label">
                <span>Comentario (*)</span>
                <span className="edit-field-counter">{cuerpo.length} / 5000</span>
              </div>
              <textarea
                maxLength={5000}
                rows={4}
                placeholder="Escribí tu comentario"
                value={cuerpo}
                onChange={e => setCuerpo(e.target.value)}
                autoFocus
              />
            </div>
          </div>
        </div>
        <div className="create-cat-panel-footer">
          <button className="cc-cancel" type="button" onClick={closePanel}>Cancelar</button>
          <button
            className="save-btn"
            type="button"
            disabled={!canSubmit || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Publicando...' : 'Comentar'}
          </button>
        </div>
      </div>
    </section>
  )
}

// ── HISTORY MODAL BODY ─────────────────────────────────────────────────────────
function HistoryModalBody({ catId }) {
  const [idx, setIdx] = useState(0)

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['category', catId, 'history'],
    queryFn: () => apiGet(`/categories/${catId}/history`).then(r => r.data),
  })

  if (isLoading) return <div className="history-empty">Cargando...</div>
  if (entries.length === 0) return <div className="history-empty">Esta categoría no tiene ediciones anteriores.</div>

  const entry = entries[idx]
  const total = entries.length

  return (
    <div className="history-carousel">
      <div className="history-header">
        <span>{idx + 1} de {total}</span>
        <span>{timeAgo(entry.fecha_edicion)}</span>
      </div>
      <div>
        <p className="history-label">Descripción anterior</p>
        <div className="history-text">{entry.descripcion_anterior}</div>
      </div>
      <div className="history-nav">
        <button
          className="history-arrow"
          disabled={idx >= total - 1}
          onClick={() => setIdx(i => i + 1)}
          aria-label="Anterior"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <button
          className="history-arrow"
          disabled={idx <= 0}
          onClick={() => setIdx(i => i - 1)}
          aria-label="Siguiente"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>
    </div>
  )
}

// ── EDIT CATEGORY MODAL ────────────────────────────────────────────────────────
function EditCategoryModal({ cat, isOpen, onClose, onSaved, onDeleteRequest }) {
  const [desc, setDesc] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const { showToast } = useToast()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (isOpen && cat) {
      setDesc(cat.descripcion || '')
      setSelectedTags(parseEtiquetas(cat.etiquetas))
    }
  }, [isOpen]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data: availableTags = [] } = useQuery({
    queryKey: ['categories', 'etiquetas'],
    queryFn: () => apiGet('/categories/etiquetas').then(r => r.data),
  })

  const mutation = useMutation({
    mutationFn: () => apiPatch(`/categories/${cat.id}`, {
      descripcion: desc.trim(),
      etiquetas: selectedTags,
    }),
    onSuccess: () => {
      showToast('Categoría actualizada', 'success')
      onClose()
      onSaved()
      queryClient.invalidateQueries({ queryKey: ['category', String(cat.id)] })
    },
    onError: (err) => {
      showToast(err.message || 'Error al guardar', 'error')
    },
  })

  function toggleTag(tag) {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : prev.length < 10 ? [...prev, tag] : prev
    )
  }

  const canSave = desc.trim().length >= 1 && selectedTags.length >= 1

  const saveBtn = (
    <button
      className="save-btn"
      type="button"
      disabled={!canSave || mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      {mutation.isPending ? 'Guardando...' : 'Guardar'}
    </button>
  )

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar categoría" headerAction={saveBtn}>
      <div className="edit-body">
        <div className="edit-field">
          <div className="edit-field-label">
            <span>Descripción (*)</span>
            <span className={`edit-field-counter${desc.length >= 500 ? ' limit' : ''}`}>
              {desc.length} / 500
            </span>
          </div>
          <textarea
            maxLength={500}
            rows={3}
            value={desc}
            onChange={e => setDesc(e.target.value)}
          />
        </div>
        <div className="edit-field">
          <div className="edit-field-label">
            <span>Etiquetas (*)</span>
            <span className="edit-field-counter">{selectedTags.length} / 10</span>
          </div>
          <div className="tags-selector">
            {availableTags.map(tag => (
              <button
                key={tag}
                type="button"
                className={`tag-option${selectedTags.includes(tag) ? ' selected' : ''}`}
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="modal-danger-zone">
        <div className="danger-zone-info">
          <span className="danger-zone-title">Eliminar categoría</span>
          <span className="danger-zone-desc">
            Esta acción no se puede deshacer. Si la categoría tiene contenido, será desactivada.
          </span>
        </div>
        <button className="btn-danger" type="button" onClick={onDeleteRequest}>Eliminar</button>
      </div>
    </Modal>
  )
}

// ── CONFIRM DELETE MODAL ───────────────────────────────────────────────────────
function ConfirmDeleteModal({ isOpen, onClose, onConfirm, isPending }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="¿Eliminar categoría?">
      <div className="confirm-delete-body">
        <p>
          Esta acción es <strong>irreversible</strong>. Todo el contenido asociado
          dejará de ser accesible desde el feed y las búsquedas.
        </p>
        <div className="confirm-delete-actions">
          <button
            className="btn-danger"
            type="button"
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? 'Eliminando...' : 'Eliminar categoría'}
          </button>
          <button className="btn-ghost" type="button" onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </Modal>
  )
}

// ── MAIN PAGE ──────────────────────────────────────────────────────────────────
export function CategoryPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [activeTab, setActiveTab] = useState('temas')
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)

  const { data: cat, isLoading: catLoading, isError } = useQuery({
    queryKey: ['category', id],
    queryFn: () => apiGet(`/categories/${id}`).then(r => r.data),
  })

  const { data: replies = [], isLoading: repliesLoading } = useQuery({
    queryKey: ['replies', 'category', id],
    queryFn: () => apiGet(`/replies/category/${id}`).then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: () => apiDelete(`/categories/${id}/delete`),
    onSuccess: (data) => {
      showToast(data?.message || 'Categoría eliminada', 'success')
      navigate('/')
    },
    onError: (err) => {
      showToast(err.message || 'Error al eliminar', 'error')
    },
  })

  if (catLoading) {
    return (
      <div>
        <div className="skeleton-card" style={{ marginBottom: 16 }}>
          <div className="skeleton" style={{ height: 22, width: '40%', marginBottom: 10 }} />
          <div className="skeleton" style={{ height: 14, width: '70%', marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 14, width: '50%' }} />
        </div>
        <TopicSkeleton />
      </div>
    )
  }

  if (isError || !cat) {
    return <div className="feed-empty">Categoría no encontrada.</div>
  }

  const isActive = cat.estado !== 'inactiva'
  const isOwner = !!(user && (user.id === cat.autor_id || user.rol === 'admin'))
  const etiquetas = parseEtiquetas(cat.etiquetas)
  const topicCount = cat.topics?.length ?? Number(cat.contador_temas) ?? 0
  const commentCount = replies.length

  const dropdownItems = []

  if (isOwner && isActive) {
    dropdownItems.push({
      label: 'Editar categoría',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      ),
      onClick: () => setEditOpen(true),
    })
  }

  dropdownItems.push(
    {
      label: 'Reportar',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
          <line x1="4" y1="22" x2="4" y2="15"/>
        </svg>
      ),
      onClick: () => showToast('Función de reporte próximamente', 'info'),
    },
    {
      label: 'Historial de ediciones',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      ),
      onClick: () => setHistoryOpen(true),
    },
  )

  return (
    <>
      {/* Breadcrumb */}
      <nav className="breadcrumb" aria-label="Navegación">
        <Link to="/">Inicio</Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M9 18l6-6-6-6"/>
        </svg>
        <span>{isActive ? cat.titulo : 'Categoría inactiva'}</span>
      </nav>

      {/* Category header */}
      <div className="cat-header">
        {!isActive ? (
          <div className="cat-inactive-banner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div className="cat-inactive-text">
              <span className="cat-inactive-title">Esta categoría ya no está disponible</span>
              <span className="cat-inactive-desc">
                El contenido publicado se preserva por la{' '}
                <a href="/about/content_policies" target="_blank" rel="noopener noreferrer">
                  política de preservación de contenido
                </a>.
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className="cat-header-top">
              <div className="cat-icon-wrap">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1.5"/>
                  <rect x="14" y="3" width="7" height="7" rx="1.5"/>
                  <rect x="3" y="14" width="7" height="7" rx="1.5"/>
                  <rect x="14" y="14" width="7" height="7" rx="1.5"/>
                </svg>
              </div>
              <div className="cat-header-info">
                <h1 className="cat-title">{cat.titulo}</h1>
                <p className="cat-desc">{cat.descripcion}</p>
              </div>
              <DropdownMenu items={dropdownItems} />
            </div>

            {etiquetas.length > 0 && (
              <div className="cat-tags">
                {etiquetas.map(e => <span key={e} className="tag">{e}</span>)}
              </div>
            )}

            <div className="cat-meta">
              <span className="cat-meta-item">
                <strong>{topicCount}</strong> {topicCount === 1 ? 'tema' : 'temas'}
              </span>
              <span className="cat-meta-item">
                creada <strong>{timeAgo(cat.fecha_creacion)}</strong>
              </span>
              {isOwner && (
                <button className="btn-ghost" type="button" onClick={() => setEditOpen(true)}>
                  Editar categoría
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Tabs */}
      <nav className="section-tabs" role="tablist">
        <button
          className={`tab${activeTab === 'temas' ? ' active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'temas'}
          onClick={() => setActiveTab('temas')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h16M4 12h16M4 18h10"/>
          </svg>
          Temas <span className="count">{topicCount}</span>
        </button>
        <button
          className={`tab${activeTab === 'comentarios' ? ' active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'comentarios'}
          onClick={() => setActiveTab('comentarios')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Comentarios <span className="count">{commentCount}</span>
        </button>
      </nav>

      {/* Topics panel */}
      {activeTab === 'temas' && (
        <div className="section-panel">
          {user && isActive && <CreateTopicPanel categoryId={id} user={user} />}
          {catLoading ? (
            <TopicSkeleton />
          ) : !cat.topics || cat.topics.length === 0 ? (
            <div className="feed-empty">
              Todavía no hay temas en esta categoría. ¡Sé el primero en crear uno!
            </div>
          ) : (
            cat.topics.map(t => <TopicCard key={t.contenido_id} topic={t} />)
          )}
        </div>
      )}

      {/* Comments panel */}
      {activeTab === 'comentarios' && (
        <div className="section-panel">
          {user && isActive && <CreateCommentPanel categoryId={id} user={user} />}
          {repliesLoading ? (
            <div className="feed-empty">Cargando comentarios...</div>
          ) : replies.length === 0 ? (
            <div className="feed-empty">Todavía no hay comentarios en esta categoría.</div>
          ) : (
            replies.map(c => <CommentCard key={c.contenido_id || c.id} comment={c} />)
          )}
        </div>
      )}

      {/* Edit modal */}
      {isOwner && isActive && (
        <EditCategoryModal
          cat={cat}
          isOpen={editOpen}
          onClose={() => setEditOpen(false)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ['category', id] })}
          onDeleteRequest={() => {
            setEditOpen(false)
            setDeleteOpen(true)
          }}
        />
      )}

      {/* Confirm delete modal */}
      {isOwner && (
        <ConfirmDeleteModal
          isOpen={deleteOpen}
          onClose={() => setDeleteOpen(false)}
          onConfirm={() => deleteMutation.mutate()}
          isPending={deleteMutation.isPending}
        />
      )}

      {/* History modal */}
      <Modal
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title="Historial de ediciones"
      >
        {historyOpen && <HistoryModalBody catId={id} />}
      </Modal>
    </>
  )
}
