import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'
import { CommentThread } from '../../components/shared/CommentThread'

// Página de hilo de un comentario, independiente del ámbito (categoría, tema o
// Home). Es el permalink que usan las notificaciones, guardados y el perfil para
// los comentarios de Home, que no tienen un contenedor del que derivar la URL.
// Reutiliza CommentThread: siembra el hilo con la raíz de la cadena de ancestros
// y deja que el drill-down por `initialCommentId` resalte el comentario pedido
// (mismo comportamiento que el deep-link de un comentario de categoría).
export function CommentPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: chain, isLoading, isError } = useQuery({
    queryKey: ['comment', id],
    queryFn: () => apiGet(`/replies/${id}/context`).then(r => r.data),
  })

  if (isLoading) return <div className="feed-page"><div className="feed-empty">Cargando...</div></div>
  if (isError || !chain || chain.length === 0) {
    return <div className="feed-page"><div className="feed-empty">Comentario no encontrado.</div></div>
  }

  // La cadena viene ordenada por profundidad DESC: la raíz primero, el
  // comentario pedido último (profundidad 0).
  const root = chain[0]

  return (
    <div className="feed-page">
      <button className="back-btn" type="button" onClick={() => navigate(-1)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
        Volver
      </button>
      <CommentThread
        comments={[root]}
        initialCommentId={id}
        invalidateKey={['comment', id]}
      />
    </div>
  )
}
