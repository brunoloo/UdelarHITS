import { useState, useEffect } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { useRequireAuth } from '../../hooks/useRequireAuth'
import { apiGet, apiPost, apiPatch, apiDelete } from '../../api/client'
import { resolveAutor } from '../../components/shared/AuthorDisplay'
import { UserAvatar } from '../../components/shared/UserAvatar'
import { ReadMore } from '../../components/ui/ReadMore'
import { DropdownMenu } from '../../components/ui/DropdownMenu'
import { useSaved } from '../../hooks/useSaved'
import { BookmarkIcon } from '../../components/shared/BookmarkIcon'
import { Modal } from '../../components/ui/Modal'
import { CommentThread } from '../../components/shared/CommentThread'
import { ReportModal } from '../../components/shared/ReportModal'
import { AttachmentButton, AttachmentPreviews } from '../../components/shared/AttachmentPicker'
import { PollButton, PollEditor } from '../../components/shared/PollEditor'
import { buildReplyFormData } from '../../utils/attachments'
import { nuevaEncuesta, pollValido } from '../../utils/poll'
import { timeAgo } from '../../utils/timeAgo'
import { trackCreateComment } from '../../utils/analytics'
import '../category/category.css'
import './topic.css'

export function TopicPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const commentIdParam = searchParams.get('commentId')
  const { user } = useAuth()
  const { showToast } = useToast()
  const { isSaved, toggleSaved } = useSaved()
  const requireAuth = useRequireAuth()
  const queryClient = useQueryClient()

  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editCuerpo, setEditCuerpo] = useState('')
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)
  const [historyModalOpen, setHistoryModalOpen] = useState(false)
  const [historyEntries, setHistoryEntries] = useState([])
  const [historyIndex, setHistoryIndex] = useState(0)
  const [commentText, setCommentText] = useState('')
  const [commentFiles, setCommentFiles] = useState([])
  const [commentPoll, setCommentPoll] = useState(null)
  const [commentFormOpen, setCommentFormOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  const { data: topic, isLoading, isError } = useQuery({
    queryKey: ['topic', id],
    queryFn: () => apiGet(`/topics/${id}`).then(r => r.data),
  })

  const { data: replies = [] } = useQuery({
    queryKey: ['replies', 'topic', id],
    queryFn: () => apiGet(`/replies/topic/${id}`).then(r => r.data),
    enabled: !!topic,
  })

  useEffect(() => {
    if (editModalOpen && topic) setEditCuerpo(topic.cuerpo || '')
  }, [editModalOpen, topic])

  const editMutation = useMutation({
    mutationFn: (cuerpo) => apiPatch(`/topics/${id}`, { cuerpo }),
    onSuccess: () => {
      showToast('Tema actualizado', 'success')
      setEditModalOpen(false)
      queryClient.invalidateQueries({ queryKey: ['topic', id] })
    },
    onError: (err) => showToast(err.message || 'Error al guardar', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => apiDelete(`/topics/${id}/delete`),
    onSuccess: (data) => {
      showToast(data?.message || 'Tema eliminado', 'success')
      setConfirmDeleteOpen(false)
      navigate(`/category/${encodeURIComponent(topic.categoria_id)}`)
    },
    onError: (err) => showToast(err.message || 'Error al eliminar', 'error'),
  })

  const commentMutation = useMutation({
    mutationFn: (cuerpo) => apiPost('/replies/create',
      buildReplyFormData({ cuerpo, tema_id: id }, commentFiles, commentPoll)
    ),
    onSuccess: (res) => {
      // El backend publica el comentario aunque los adjuntos fallen (p. ej.
      // cuota de almacenamiento); si pasó eso, avisa con la advertencia.
      trackCreateComment('direct')
      if (res?.data?.advertencia) showToast(res.data.advertencia, 'error')
      else showToast('Comentario publicado', 'success')
      setCommentText('')
      setCommentFiles([])
      setCommentPoll(null)
      setCommentFormOpen(false)
      queryClient.invalidateQueries({ queryKey: ['replies', 'topic', id] })
    },
    onError: (err) => showToast(err.message || 'Error al publicar', 'error'),
  })

  // Fijar/desanclar un comentario del tema (solo el creador del tema).
  const pinCommentMutation = useMutation({
    mutationFn: (comment) => comment.fijado
      ? apiDelete(`/topics/${id}/pin`)
      : apiPost(`/topics/${id}/pin`, { item_id: comment.id }),
    onSuccess: (_data, comment) => {
      showToast(comment.fijado ? 'Comentario desanclado' : 'Comentario fijado', 'success')
      queryClient.invalidateQueries({ queryKey: ['replies', 'topic', id] })
    },
    onError: (err) => showToast(err.message || 'No se pudo fijar', 'error'),
  })

  function handleCommentSubmit() {
    if (!requireAuth('Debes iniciar sesión para comentar')) return
    const vacio = commentText.trim().length < 1 && commentFiles.length === 0 && !pollValido(commentPoll)
    if (vacio || commentMutation.isPending) return
    commentMutation.mutate(commentText.trim())
  }

  async function loadHistory() {
    const res = await apiGet(`/topics/${id}/history`)
    setHistoryEntries(res?.data || [])
    setHistoryIndex(0)
    setHistoryModalOpen(true)
  }

  if (isLoading) return <div className="feed-empty">Cargando...</div>
  if (isError || !topic) return <div className="feed-empty">Tema no encontrado.</div>

  const isInactive = topic.estado === 'inactivo'
  const catInactiva = topic.categoria_estado === 'inactiva'
  const autor = resolveAutor(topic)
  const isAuthor = user && user.id == topic.autor_id
  const isAdmin = user && user.rol === 'admin'
  const canManage = (isAuthor || isAdmin) && !isInactive

  const temaGuardado = isSaved('tema', id)
  const menuItems = []

  menuItems.push({
    label: temaGuardado ? 'Quitar de guardados' : 'Guardar',
    icon: <BookmarkIcon filled={temaGuardado} size={14} />,
    onClick: () => toggleSaved('tema', id),
  })

  menuItems.push({
    label: 'Reportar',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
      </svg>
    ),
    onClick: () => {
      if (isAuthor) { showToast('No podés reportar tu propio contenido', 'error'); return }
      setReportOpen(true)
    },
  })

  menuItems.push({
    label: 'Historial de ediciones',
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
    onClick: loadHistory,
  })

  // Eliminar: acción destructiva, directa desde el menú de tres puntos (antes
  // vivía dentro del modal de "Editar tema"). Pasa por el ConfirmDelete modal.
  if (canManage) {
    menuItems.push({
      label: 'Eliminar tema',
      danger: true,
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      ),
      onClick: () => setConfirmDeleteOpen(true),
    })
  }


  return (
    <>
      <nav className="breadcrumb" aria-label="Navegación">
        <Link to="/">Inicio</Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M9 18l6-6-6-6"/>
        </svg>
        <Link to={`/category/${encodeURIComponent(topic.categoria_id)}`}>
          {catInactiva ? 'Categoría inactiva' : (topic.categoria_titulo || 'Categoría')}
        </Link>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M9 18l6-6-6-6"/>
        </svg>
        <span>{isInactive ? 'Tema inactivo' : topic.titulo}</span>
      </nav>

      <div className="topic-header">
        {isInactive ? (
          <div className="cat-inactive-banner">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div className="cat-inactive-text">
              <span className="cat-inactive-title">Este tema ya no está disponible</span>
              <span className="cat-inactive-desc">
                El contenido publicado se preserva por la{' '}
                <Link to="/about/policies" target="_blank" rel="noopener noreferrer">
                  política de preservación de contenido
                </Link>.
              </span>
            </div>
          </div>
        ) : (
          <>
            <div className="topic-header-top-row">
              <div className="topic-header-meta">
                <UserAvatar
                  url_imagen={autor.url_imagen}
                  nickname={autor.nickname}
                  size="md"
                  inactive={autor.isInactive}
                />
                <div className="topic-header-meta-text">
                  {autor.isInactive ? (
                    <span className="inactive-author">{autor.nickname}</span>
                  ) : (
                    <Link to={`/user/${encodeURIComponent(autor.nickname)}`} className="topic-header-author">
                      {autor.nickname}
                    </Link>
                  )}
                  <span className="topic-header-date">{timeAgo(topic.fecha_creacion)}</span>
                </div>
              </div>
              <DropdownMenu items={menuItems} />
            </div>
            <h1 className="topic-header-title">{topic.titulo}</h1>
            <div className="topic-header-body">
              <ReadMore text={topic.cuerpo} maxLength={500} />
            </div>
            <div className="cat-meta">
              <span className="cat-meta-item">
                <strong>{replies.length}</strong>{' '}
                {replies.length === 1 ? 'comentario' : 'comentarios'}
              </span>
              <span className="cat-meta-item">
                creado <strong>{timeAgo(topic.fecha_creacion)}</strong>
              </span>
              {canManage && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setEditModalOpen(true)}
                >
                  Editar tema
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <nav className="section-tabs" role="tablist">
        <button className="tab active" role="tab">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Comentarios <span className="count">{replies.length}</span>
        </button>
      </nav>

      <section className="section-panel active">
        {!isInactive && (
          <section className="create-topic" aria-label="Publicar comentario">
            {!commentFormOpen ? (
              <button
                className="create-topic-trigger"
                type="button"
                onClick={() => setCommentFormOpen(true)}
              >
                <UserAvatar url_imagen={user?.url_imagen} nickname={user?.nickname} size="sm" />
                <span className="ct-placeholder">Publicar comentario</span>
                <span className="ct-cta">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  Comentar
                </span>
              </button>
            ) : (
              <div className="create-cat-panel open">
                <div className="create-cat-panel-body">
                  <div className="cc-form">
                    <div className="edit-field">
                      <div className="edit-field-label">
                        <span>Comentario (*)</span>
                        <span className="edit-field-counter">{commentText.length} / 5000</span>
                      </div>
                      <textarea
                        maxLength={5000}
                        rows={4}
                        placeholder="Escribí tu comentario"
                        value={commentText}
                        onChange={e => setCommentText(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <AttachmentPreviews files={commentFiles} onChange={setCommentFiles} />
                    <PollEditor poll={commentPoll} onChange={setCommentPoll} onRemove={() => setCommentPoll(null)} />
                  </div>
                </div>
                <div className="create-cat-panel-footer">
                  <AttachmentButton files={commentFiles} onChange={setCommentFiles} disabled={commentMutation.isPending} />
                  <PollButton active={!!commentPoll} onActivate={() => setCommentPoll(nuevaEncuesta())} disabled={commentMutation.isPending} />
                  <button
                    className="cc-cancel"
                    type="button"
                    onClick={() => { setCommentFormOpen(false); setCommentText(''); setCommentFiles([]); setCommentPoll(null) }}
                  >
                    Cancelar
                  </button>
                  <button
                    className="save-btn"
                    type="button"
                    disabled={(commentText.trim().length < 1 && commentFiles.length === 0 && !pollValido(commentPoll)) || commentMutation.isPending}
                    onClick={handleCommentSubmit}
                  >
                    {commentMutation.isPending ? 'Publicando...' : 'Comentar'}
                  </button>
                </div>
              </div>
            )}
          </section>
        )}

        <CommentThread
          comments={replies}
          invalidateKey={['replies', 'topic', id]}
          initialCommentId={commentIdParam}
          canPin={isAuthor || isAdmin}
          onTogglePin={(c) => pinCommentMutation.mutate(c)}
          onInitialDrillDone={() => {
            searchParams.delete('commentId')
            setSearchParams(searchParams, { replace: true })
          }}
        />
      </section>

      {/* Edit modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Editar tema"
        headerAction={
          <button
            className="save-btn"
            type="button"
            disabled={editCuerpo.trim().length < 1 || editMutation.isPending}
            onClick={() => editMutation.mutate(editCuerpo.trim())}
          >
            {editMutation.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        }
      >
        <div className="edit-body">
          <div className="edit-field">
            <div className="edit-field-label">
              <span>Contenido</span>
              <span className="edit-field-counter">{editCuerpo.length} / 500</span>
            </div>
            <textarea
              maxLength={500}
              rows={5}
              value={editCuerpo}
              onChange={e => setEditCuerpo(e.target.value)}
              autoFocus
            />
          </div>
        </div>
      </Modal>

      {/* Confirm delete modal */}
      <Modal
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        title="¿Eliminar tema?"
      >
        <div className="confirm-delete-body">
          <p>
            Esta acción es <strong>irreversible</strong>. Todo el contenido asociado dejará de ser
            accesible desde la categoría y las búsquedas.
          </p>
          <div className="confirm-delete-actions">
            <button
              className="btn-ghost"
              type="button"
              onClick={() => setConfirmDeleteOpen(false)}
            >
              Cancelar
            </button>
            <button
              className="btn-danger"
              type="button"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending ? 'Eliminando...' : 'Eliminar tema'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Report modal */}
      <ReportModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        contentId={id}
        contentType="topic"
      />

      {/* History modal */}
      <Modal
        isOpen={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        title="Historial de ediciones"
      >
        <div className="history-body">
          {historyEntries.length === 0 ? (
            <div className="history-empty">Este tema no tiene ediciones anteriores.</div>
          ) : (
            <div className="history-carousel">
              <div className="history-header">
                <span className="history-counter">{historyIndex + 1} de {historyEntries.length}</span>
                <span className="history-date">{timeAgo(historyEntries[historyIndex].fecha_edicion)}</span>
              </div>
              <div className="history-content">
                <p className="history-label">Contenido anterior</p>
                <div className="history-text">{historyEntries[historyIndex].contenido_anterior}</div>
              </div>
              <div className="history-nav">
                <button
                  className="history-arrow"
                  type="button"
                  disabled={historyIndex >= historyEntries.length - 1}
                  onClick={() => setHistoryIndex(i => i + 1)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 18l-6-6 6-6"/>
                  </svg>
                </button>
                <button
                  className="history-arrow"
                  type="button"
                  disabled={historyIndex <= 0}
                  onClick={() => setHistoryIndex(i => i - 1)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </>
  )
}
