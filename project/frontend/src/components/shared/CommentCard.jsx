import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { useRequireAuth } from '../../hooks/useRequireAuth'
import { apiPatch, apiDelete } from '../../api/client'
import { resolveAutor } from './AuthorDisplay'
import { UserAvatar } from './UserAvatar'
import { ReadMore } from '../ui/ReadMore'
import { DropdownMenu } from '../ui/DropdownMenu'
import { CommentForm } from './CommentForm'
import { ReportModal } from './ReportModal'
import { timeAgo } from '../../utils/timeAgo'
import './CommentCard.css'

export function CommentCard({
  comment,
  role = 'reply',
  onReply,
  onDrillDown,
  invalidateKey,
}) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const requireAuth = useRequireAuth()
  const queryClient = useQueryClient()

  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState('')
  const [replyOpen, setReplyOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)

  const isHidden = comment.estado === 'oculto'
  const replyCount = Number(comment.contador_respuestas) || 0
  const isAuthor = user && user.id == comment.autor_id
  const isAdmin = user && user.rol === 'admin'
  const canEdit = isAuthor && !isHidden
  const canDelete = (isAuthor || isAdmin) && !isHidden

  const editMutation = useMutation({
    mutationFn: (cuerpo) => apiPatch(`/replies/update/${comment.id}`, { cuerpo }),
    onSuccess: () => {
      showToast('Comentario actualizado', 'success')
      setEditing(false)
      if (invalidateKey) queryClient.invalidateQueries({ queryKey: invalidateKey })
    },
    onError: (err) => showToast(err.message || 'Error al editar', 'error'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => apiDelete(`/replies/delete/${comment.id}`),
    onSuccess: (data) => {
      showToast(data?.message || 'Comentario eliminado', 'success')
      if (invalidateKey) queryClient.invalidateQueries({ queryKey: invalidateKey })
    },
    onError: (err) => showToast(err.message || 'Error al eliminar', 'error'),
  })

  // Hidden comment placeholder
  if (isHidden) {
    const hiddenText = comment.motivo_inactivacion === 'moderacion_reporte'
      ? 'Este comentario fue ocultado por la comunidad'
      : 'Este comentario fue eliminado por su autor'

    const cardClasses = ['comment-card', 'comment-card--hidden']
    if (role === 'ancestor') cardClasses.push('comment-card--ancestor')
    if (role === 'reply' && replyCount > 0) cardClasses.push('comment-card--clickable')

    return (
      <div
        className={cardClasses.join(' ')}
        onClick={role === 'reply' && replyCount > 0 && onDrillDown ? () => onDrillDown(comment) : undefined}
      >
        <div className="comment-gutter">
          <div className="comment-avatar comment-avatar--empty" />
        </div>
        <div className="comment-body">
          <div className="comment-hidden-text">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {hiddenText}
          </div>
          {replyCount > 0 && (
            <div className="comment-actions">
              <span className="comment-action-info">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                {replyCount} {replyCount === 1 ? 'respuesta' : 'respuestas'}
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Visible comment
  const autor = resolveAutor(comment)

  const cardClasses = ['comment-card']
  if (role === 'ancestor') cardClasses.push('comment-card--ancestor')
  if (role === 'reply') cardClasses.push('comment-card--clickable')

  function handleCardClick(e) {
    if (role !== 'reply' || !onDrillDown) return
    if (e.target.closest('a') || e.target.closest('button') || e.target.closest('.inline-reply-panel')) return
    onDrillDown(comment)
  }

  // Dropdown items
  const menuItems = []

  menuItems.push({
    label: 'Reportar',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
    onClick: () => {
      if (isAuthor) {
        showToast('No podés reportar tu propio contenido', 'error')
        return
      }
      setReportOpen(true)
    },
  })

  menuItems.push({
    label: 'Historial de ediciones',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    onClick: () => showToast('Historial próximamente', 'info'),
  })

  if (canEdit) {
    menuItems.push({
      label: 'Editar comentario',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
      onClick: () => {
        setEditText(comment.cuerpo || '')
        setEditing(true)
      },
    })
  }

  if (canDelete) {
    menuItems.push({
      label: 'Eliminar comentario',
      icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
      danger: true,
      onClick: () => deleteMutation.mutate(),
    })
  }

  return (
    <>
    <div className={cardClasses.join(' ')} onClick={handleCardClick}>
      <div className="comment-gutter">
        <UserAvatar
          url_imagen={autor.url_imagen}
          nickname={autor.nickname}
          size="md"
          inactive={autor.isInactive}
        />
      </div>
      <div className="comment-body">
        <div className="comment-body-top">
          <div className="comment-head">
            {autor.isInactive ? (
              <span className="inactive-author">{autor.nickname}</span>
            ) : (
              <Link to={`/user/${encodeURIComponent(autor.nickname)}`} onClick={e => e.stopPropagation()}>
                {autor.nickname}
              </Link>
            )}
            <span>·</span>
            <span>{timeAgo(comment.fecha_creacion)}</span>
          </div>
          <DropdownMenu items={menuItems} />
        </div>

        {editing ? (
          <div className="inline-reply-panel" onClick={e => e.stopPropagation()}>
            <div className="edit-field">
              <div className="edit-field-label">
                <span>Editar comentario</span>
                <span className="edit-field-counter">{editText.length} / 5000</span>
              </div>
              <textarea
                className="inline-reply-input"
                maxLength={5000}
                rows={4}
                value={editText}
                onChange={e => setEditText(e.target.value)}
                autoFocus
              />
            </div>
            <div className="inline-reply-actions">
              <button className="cc-cancel" type="button" onClick={() => setEditing(false)}>Cancelar</button>
              <button
                className="save-btn"
                type="button"
                disabled={editText.trim().length < 1 || editMutation.isPending}
                onClick={() => editMutation.mutate(editText.trim())}
              >
                {editMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="comment-text">
              <ReadMore text={comment.cuerpo} maxLength={500} />
            </div>
            <div className="comment-actions">
              <button
                className="comment-action-btn"
                type="button"
                onClick={e => { e.stopPropagation(); setReplyOpen(v => !v) }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Responder
              </button>
              {replyCount > 0 && (
                <span className="comment-action-info">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                  {replyCount} {replyCount === 1 ? 'respuesta' : 'respuestas'}
                </span>
              )}
            </div>
          </>
        )}

        {replyOpen && !editing && (
          <CommentForm
            placeholder="Respuesta (*)"
            submitLabel="Responder"
            autoFocus
            onCancel={() => setReplyOpen(false)}
            onSubmit={async (text) => {
              if (!requireAuth('Iniciá sesión para responder')) return
              if (onReply) {
                await onReply(comment.id, text)
                setReplyOpen(false)
              }
            }}
          />
        )}
      </div>
    </div>

    <ReportModal
      isOpen={reportOpen}
      onClose={() => setReportOpen(false)}
      contentId={comment.id}
      contentType="comment"
    />
    </>
  )
}
