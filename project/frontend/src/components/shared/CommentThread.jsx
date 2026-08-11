import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../hooks/useToast'
import { apiGet, apiPost } from '../../api/client'
import { buildReplyFormData } from '../../utils/attachments'
import { trackCreateComment } from '../../utils/analytics'
import { CommentCard } from './CommentCard'
import './CommentCard.css'

export function CommentThread({ comments, invalidateKey, invalidateKeys = null, initialCommentId, initialStack = null, onExit = null, onInitialDrillDone, canPin = false, onTogglePin }) {
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const lastDrilledId = useRef(null)

  // initialStack: siembra el hilo "ya adentro" de un comentario (permalink
  // /comment/:id, que arranca mostrando el comentario con sus respuestas). En
  // CategoryPage/TopicPage no se pasa → arranca vacío, como siempre.
  const [stack, setStack] = useState(() => initialStack || [])
  const [highlightedId, setHighlightedId] = useState(null)

  useEffect(() => {
    if (!initialCommentId) {
      lastDrilledId.current = null
      return
    }
    if (lastDrilledId.current === initialCommentId) return
    lastDrilledId.current = initialCommentId
    apiGet(`/replies/${initialCommentId}/context`)
      .then(chain => {
        if (!chain?.data || chain.data.length === 0) return
        const ancestors = chain.data.slice(0, -1)
        setStack(ancestors)
        setHighlightedId(String(initialCommentId))
        onInitialDrillDone?.()
      })
      .catch(() => {})
  }, [initialCommentId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!highlightedId) return
    const timer = setTimeout(() => {
      const el = document.querySelector(`[data-comment-id="${highlightedId}"]`)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 150)
    const clearTimer = setTimeout(() => setHighlightedId(null), 2500)
    return () => { clearTimeout(timer); clearTimeout(clearTimer) }
  }, [highlightedId])
  const currentParent = stack.length > 0 ? stack[stack.length - 1] : null

  const { data: childReplies = [], isLoading: repliesLoading } = useQuery({
    queryKey: ['replies', currentParent?.id, 'replies'],
    queryFn: () => apiGet(`/replies/${currentParent.id}/replies`).then(r => r.data),
    enabled: !!currentParent,
  })

  const replyMutation = useMutation({
    mutationFn: ({ parentId, cuerpo, files, poll }) => apiPost('/replies/create',
      buildReplyFormData({ cuerpo, comentario_padre_id: parentId }, files, poll)
    ),
    onSuccess: (res, { parentId }) => {
      trackCreateComment('reply')
      if (res?.data?.advertencia) showToast(res.data.advertencia, 'error')
      else showToast('Respuesta publicada', 'success')
      // Hijos del comentario al que se respondió (la lista que muestra el hilo)
      // + las claves de contexto del contenedor (perfil/guardados no pasan
      // ninguna; CategoryPage/TopicPage pasan la suya; el permalink pasa el
      // contexto del comentario y el feed del Home). Ver invalidateKeys.
      queryClient.invalidateQueries({ queryKey: ['replies', parentId, 'replies'] })
      if (invalidateKey) queryClient.invalidateQueries({ queryKey: invalidateKey })
      for (const k of (invalidateKeys || [])) queryClient.invalidateQueries({ queryKey: k })
    },
    onError: (err) => showToast(err.message || 'Error al publicar', 'error'),
  })

  function drillDown(comment) {
    setStack(prev => [...prev, comment])
  }

  function goBack() {
    // "Volver" sube un nivel en el hilo. En un permalink el hilo arranca sobre un
    // piso (initialStack): al llegar a ese piso, "Volver" sale de la página
    // (onExit) en vez de dejar el stack por debajo del comentario abierto. Sin
    // initialStack/onExit (categoría/tema) el piso es 0 y se comporta igual que
    // antes: sube un nivel y desaparece al volver a la lista.
    const floor = initialStack ? initialStack.length : 0
    if (stack.length <= floor) {
      onExit?.()
      return
    }
    setStack(prev => prev.slice(0, -1))
  }

  function handleReply(parentId, text, files, poll) {
    return replyMutation.mutateAsync({ parentId, cuerpo: text, files, poll })
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
          {stack.map((anc, i) => {
            // Show the thread line only when there is at least one comment
            // visible below this ancestor: either another ancestor in the
            // chain, or (for the deepest ancestor) actual replies underneath.
            const isLastAncestor = i === stack.length - 1
            const showThreadLine = isLastAncestor
              ? visibleComments.length > 0
              : true
            return (
              <CommentCard
                key={anc.id + '-anc-' + i}
                comment={anc}
                role="ancestor"
                showThreadLine={showThreadLine}
                onReply={handleReply}
                invalidateKey={invalidateKey}
                invalidateKeys={invalidateKeys}
              />
            )
          })}
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
              highlighted={String(c.id || c.contenido_id) === highlightedId}
              onDrillDown={drillDown}
              onReply={handleReply}
              invalidateKey={invalidateKey}
              invalidateKeys={invalidateKeys}
              canPin={canPin && !currentParent}
              onTogglePin={onTogglePin}
            />
          ))
        )}
      </div>
    </div>
  )
}
