import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../../hooks/useToast'
import { apiGet, apiPost } from '../../api/client'
import { buildReplyFormData } from '../../utils/attachments'
import { trackCreateComment } from '../../utils/analytics'
import { CommentCard } from './CommentCard'
import './CommentCard.css'

// onPositionChange avisa en qué comentario quedó el usuario al moverse por el hilo; no se
// dispara al montar. Lo usa el permalink para reescribir la URL.
export function CommentThread({ comments, invalidateKey, invalidateKeys = null, initialCommentId, initialStack = null, initialHighlightId = null, onExit = null, onPositionChange = null, onInitialDrillDone, canPin = false, onTogglePin, embedVideos = false }) {
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const lastDrilledId = useRef(null)

  // initialStack abre el hilo dentro de un comentario (permalink).
  const [stack, setStack] = useState(() => initialStack || [])
  // Piso del stack: por debajo de este nivel "Volver" sale de la página. Es estado porque
  // clickear un ancestro lo baja.
  const [floor, setFloor] = useState(() => initialStack?.length ?? 0)
  // Resalta el comentario enfocado al abrir el permalink.
  const [highlightedId, setHighlightedId] = useState(() =>
    initialHighlightId != null ? String(initialHighlightId) : null
  )

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
      // Los hijos del comentario respondido y las claves de contexto del contenedor.
      queryClient.invalidateQueries({ queryKey: ['replies', parentId, 'replies'] })
      if (invalidateKey) queryClient.invalidateQueries({ queryKey: invalidateKey })
      for (const k of (invalidateKeys || [])) queryClient.invalidateQueries({ queryKey: k })
    },
    onError: (err) => showToast(err.message || 'Error al publicar', 'error'),
  })

  function drillDown(comment) {
    setStack(prev => [...prev, comment])
    // Fuera del updater: es un side effect y un updater puede correr dos veces.
    onPositionChange?.(comment)
  }

  // Clickear un ancestro trunca el stack hasta él, sin refetch ni cambio de URL.
  function drillUpTo(index) {
    setStack(prev => prev.slice(0, index + 1))
    // Al navegar la cadena a mano el piso baja a la raíz, para que "Volver" suba de a un nivel.
    setFloor(f => Math.min(f, initialStack ? 1 : 0))
    onPositionChange?.(stack[index])
  }

  function goBack() {
    // Al llegar al piso, "Volver" sale de la página en vez de seguir subiendo.
    if (stack.length <= floor) {
      // Salir no es un cambio de posición: avisarlo reescribiría la URL justo antes de irse.
      onExit?.()
      return
    }
    setStack(prev => prev.slice(0, -1))
    onPositionChange?.(stack[stack.length - 2] ?? null)
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
            // La línea del hilo se muestra solo si hay algún comentario visible debajo de este ancestro.
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
                highlighted={String(anc.id || anc.contenido_id) === highlightedId}
                // El último ancestro es la posición actual: sin handler.
                onDrillDown={isLastAncestor ? undefined : () => drillUpTo(i)}
                onReply={handleReply}
                invalidateKey={invalidateKey}
                invalidateKeys={invalidateKeys}
                embedVideos={embedVideos}
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
              embedVideos={embedVideos}
            />
          ))
        )}
      </div>
    </div>
  )
}
