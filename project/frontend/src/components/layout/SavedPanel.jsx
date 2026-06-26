import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { apiGet, apiPost } from '../../api/client'
import { buildReplyFormData } from '../../utils/attachments'
import { CategoryCardMini } from '../shared/CategoryCardMini'
import { TopicCardMini } from '../shared/TopicCardMini'
import { CommentEntry } from '../shared/CommentEntry'

const SAVED_KEY = ['saved', 'list']

// Panel deslizable (mismo chrome que el de notificaciones) con la lista de
// guardados del usuario: categorías, temas y comentarios, ordenados por fecha de
// guardado. Reutiliza las mismas cards que el perfil público.
export function SavedPanel({ open, panelRef, onClose }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const queryClient = useQueryClient()

  const { data: items = [], isLoading } = useQuery({
    queryKey: SAVED_KEY,
    queryFn: () => apiGet('/saved').then(r => r.data),
    enabled: !!user && open,
  })

  // Permite responder un comentario guardado desde el panel.
  const replyMutation = useMutation({
    mutationFn: ({ parentId, cuerpo, files, poll }) =>
      apiPost('/replies/create', buildReplyFormData({ cuerpo, comentario_padre_id: parentId }, files, poll)),
    onSuccess: () => {
      showToast('Respuesta publicada', 'success')
      queryClient.invalidateQueries({ queryKey: ['saved'] })
    },
    onError: (err) => showToast(err.message || 'Error al publicar', 'error'),
  })
  const handleReply = (parentId, text, files, poll) => replyMutation.mutateAsync({ parentId, cuerpo: text, files, poll })

  return (
    <div className={`notif-panel saved-panel${open ? ' open' : ''}`} ref={panelRef}>
      <div className="notif-panel-head">
        <h3>Guardados</h3>
        <button className="notif-panel-close" type="button" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div className="notif-panel-body">
        {!user ? (
          <div className="notif-empty"><p>Iniciá sesión para ver tus guardados</p></div>
        ) : isLoading ? (
          <div className="notif-loading">Cargando...</div>
        ) : items.length === 0 ? (
          <div className="notif-empty">Todavía no hay guardados</div>
        ) : (
          <div className="saved-list">
            {items.map(item => {
              if (item.kind === 'categoria') {
                return <CategoryCardMini key={`cat-${item.id}`} category={item} onNavigate={onClose} />
              }
              if (item.kind === 'tema') {
                return (
                  <div key={`tema-${item.id}`} className="comment-entry">
                    <div className="comment-entry-head">
                      <span>en categoría</span>
                      {item.categoria_estado === 'inactiva'
                        ? <span className="comment-entry-inactive">inactiva</span>
                        : <Link to={`/category/${encodeURIComponent(item.categoria_id)}`} onClick={onClose}>{item.categoria_titulo}</Link>}
                    </div>
                    <TopicCardMini topic={item} onNavigate={onClose} />
                  </div>
                )
              }
              return (
                <CommentEntry
                  key={`com-${item.id}`}
                  comment={item}
                  invalidateKey={SAVED_KEY}
                  onReply={handleReply}
                  onNavigate={onClose}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
