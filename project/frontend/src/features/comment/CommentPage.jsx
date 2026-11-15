import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'
import { HOME_FEED_KEY } from '../../api/queryKeys'
import { CommentThread } from '../../components/shared/CommentThread'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { commentTitle } from '../../utils/pageTitle'

// Permalink de un comentario, sea de Home, tema o categoría. Abre el hilo dentro del comentario
// (initialStack) y la URL sigue al usuario mientras se mueve. Hay dos ids: `id` (URL) es dónde
// está parado y `anchorId` es con qué comentario se abrió el hilo; desacoplados, moverse es
// solo un cambio de URL, sin refetch.
export function CommentPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  // Solo cambia ante una navegación real, no cuando la URL la reescribe esta página.
  const [anchorId, setAnchorId] = useState(id)
  // Fuerza el remount cuando se vuelve a abrir el hilo en el propio ancla, donde `anchorId` no cambia.
  const [seedNonce, setSeedNonce] = useState(0)
  // Comentario que la vista muestra abierto. Contra esto, y no contra el ancla, se decide si
  // un id nuevo en la URL es una navegación externa.
  const positionRef = useRef(id)

  const { data: chain, isLoading, isError } = useQuery({
    queryKey: ['comment', anchorId],
    queryFn: () => apiGet(`/replies/${anchorId}/context`).then(r => r.data),
  })

  // Si la URL apunta a un comentario distinto de la posición, la navegación vino de afuera
  // (notificación, link, Atrás) y el hilo se abre de nuevo ahí. Un ref y no location.state:
  // el state viaja con la entrada del historial y sobreviviría a un Atrás.
  useEffect(() => {
    if (id === positionRef.current) return
    positionRef.current = id
    setAnchorId(id)
    setSeedNonce(n => n + 1)
  }, [id])

  // replace y no push: el recorrido por el hilo ocupa una sola entrada del historial y salir
  // vuelve a donde se vino.
  const handlePositionChange = useCallback((comment) => {
    if (!comment?.id) return
    const pid = String(comment.id)
    // Siempre antes del early return: la posición cambió aunque la URL ya coincida.
    positionRef.current = pid
    if (pid === id) return
    // threadMove evita que ScrollToTop mande la página al tope.
    navigate(`/comment/${pid}`, { replace: true, state: { threadMove: true } })
  }, [navigate, id])

  // El título sale del ámbito del comentario pedido (el último de la cadena) y no se recalcula
  // al moverse: es el mismo para toda la cadena.
  const requested = Array.isArray(chain) && chain.length ? chain[chain.length - 1] : null
  useDocumentTitle(commentTitle(requested), !isLoading)

  if (isLoading) return <div className="feed-page"><div className="feed-empty">Cargando...</div></div>
  if (isError || !chain || chain.length === 0) {
    return <div className="feed-page"><div className="feed-empty">Comentario no encontrado.</div></div>
  }

  // La cadena va de la raíz al comentario pedido, que queda abierto con sus respuestas.
  return (
    <div className="feed-page">
      <CommentThread
        // Todo lo que abre el hilo va contra el ancla, no contra el id de la URL: la key, el resaltado
        // y las claves de invalidación (['comment', anchorId] es la query realmente cacheada).
        key={`${anchorId}:${seedNonce}`}
        comments={[]}
        initialStack={chain}
        initialHighlightId={anchorId}
        onExit={() => navigate(-1)}
        onPositionChange={handlePositionChange}
        invalidateKey={['comment', anchorId]}
        // Al responder o eliminar se refrescan el hilo, el contexto de esta página y el feed del inicio.
        invalidateKeys={[['replies'], ['comment', anchorId], HOME_FEED_KEY]}
        embedVideos
      />
    </div>
  )
}
