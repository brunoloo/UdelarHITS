import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { apiGet, apiPost } from '../../api/client'
import { CommentCard } from './CommentCard'
import './CommentCard.css'

export function CommentThread({ comments, invalidateKey }) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const queryClient = useQueryClient()

  const [stack, setStack] = useState([])
  const currentParent = stack.length > 0 ? stack[stack.length - 1] : null

  const { data: childReplies = [], isLoading: repliesLoading } = useQuery({
    queryKey: ['replies', currentParent?.id, 'replies'],
    queryFn: () => apiGet(`/replies/${currentParent.id}/replies`).then(r => r.data),
    enabled: !!currentParent,
  })

  const replyMutation = useMutation({
    mutationFn: ({ parentId, cuerpo }) => apiPost('/replies/create', {
      cuerpo,
      comentario_padre_id: parentId,
    }),
    onSuccess: () => {
      showToast('Respuesta publicada', 'success')
      if (currentParent) {
        queryClient.invalidateQueries({ queryKey: ['replies', currentParent.id, 'replies'] })
      }
      if (invalidateKey) queryClient.invalidateQueries({ queryKey: invalidateKey })
    },
    onError: (err) => showToast(err.message || 'Error al publicar', 'error'),
  })

  function drillDown(comment) {
    setStack(prev => [...prev, comment])
  }

  function goBack() {
    setStack(prev => {
      const next = prev.slice(0, -1)
      return next
    })
  }

  function handleReply(parentId, text) {
    return replyMutation.mutateAsync({ parentId, cuerpo: text })
  }

  const visibleComments = currentParent ? childReplies : comments

  return (
    <div>
      {stack.length > 0 && (
        <button className="back-btn" type="button" onClick={goBack}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Volver
        </button>
      )}

      {stack.length > 0 && (
        <div className="comment-thread">
          {stack.map((anc, i) => (
            <CommentCard
              key={anc.id + '-anc-' + i}
              comment={anc}
              role="ancestor"
              onReply={user ? handleReply : undefined}
              invalidateKey={invalidateKey}
            />
          ))}
        </div>
      )}

      <div className={stack.length > 0 ? 'comment-replies' : undefined}>
        {repliesLoading && currentParent ? (
          <div className="feed-empty">Cargando respuestas...</div>
        ) : !visibleComments || visibleComments.length === 0 ? (
          <div className="feed-empty">
            {stack.length === 0
              ? 'Todavía no hay comentarios. ¡Sé el primero!'
              : 'No hay respuestas a este comentario.'}
          </div>
        ) : (
          visibleComments.map(c => (
            <CommentCard
              key={c.id || c.contenido_id}
              comment={c}
              role="reply"
              onDrillDown={drillDown}
              onReply={user ? handleReply : undefined}
              invalidateKey={invalidateKey}
            />
          ))
        )}
      </div>
    </div>
  )
}
