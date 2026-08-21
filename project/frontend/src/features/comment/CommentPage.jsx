import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'
import { CommentThread } from '../../components/shared/CommentThread'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { commentTitle } from '../../utils/pageTitle'

// Página de hilo de un comentario, independiente del ámbito (categoría, tema o
// Home). Es el permalink que usan las notificaciones, guardados y el perfil para
// los comentarios de Home, que no tienen un contenedor del que derivar la URL.
//
// Reutiliza CommentThread sembrándolo YA ADENTRO del comentario (initialStack =
// la cadena de ancestros, con el comentario pedido como último): así abrir un
// comentario de Home muestra "el comentario con su hilo" (equivalente a clickear
// un comentario para ver sus respuestas), no una lista con un ítem para clickear.
//
// Hay UN solo "Volver" (el de CommentThread): sube un nivel mientras haya drill,
// y en el piso (el comentario abierto) sale de la página vía onExit. CommentPage
// NO renderiza su propio "Volver" (antes se apilaban dos).
export function CommentPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const { data: chain, isLoading, isError } = useQuery({
    queryKey: ['comment', id],
    queryFn: () => apiGet(`/replies/${id}/context`).then(r => r.data),
  })

  // La cadena viene ordenada por profundidad DESC: el comentario pedido es el
  // último. De él sale el ámbito (tema/categoría) para el título, con el mismo
  // formato del servidor ("Comentario en <contexto> · UdelarHITS"). Si el
  // comentario no existe/está oculto → título genérico.
  const requested = Array.isArray(chain) && chain.length ? chain[chain.length - 1] : null
  useDocumentTitle(commentTitle(requested), !isLoading)

  if (isLoading) return <div className="feed-page"><div className="feed-empty">Cargando...</div></div>
  if (isError || !chain || chain.length === 0) {
    return <div className="feed-page"><div className="feed-empty">Comentario no encontrado.</div></div>
  }

  // La cadena viene ordenada por profundidad DESC: la raíz primero, el comentario
  // pedido último → como stack inicial, el comentario pedido queda de currentParent
  // (se muestra con sus respuestas debajo).
  return (
    <div className="feed-page">
      <CommentThread
        key={id}
        comments={[]}
        initialStack={chain}
        initialHighlightId={id}
        onExit={() => navigate(-1)}
        invalidateKey={['comment', id]}
        // Al responder o eliminar en el permalink: refrescar el hilo (['replies']
        // cubre la lista de hijos en cualquier nivel), el contexto que carga esta
        // página, y el contador de respuestas del feed del Home.
        invalidateKeys={[['replies'], ['comment', id], ['categories', 'feed']]}
      />
    </div>
  )
}
