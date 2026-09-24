import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'
import { HOME_FEED_KEY } from '../../api/queryKeys'
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
//
// La URL acompaña al usuario mientras se mueve por el hilo, para que copiar el
// link comparta donde está parado y no por donde entró. Para eso hay DOS ids
// distintos, y la diferencia es todo el truco:
//   - `id` (useParams) = DÓNDE ESTÁS PARADO. Se reescribe en cada movimiento.
//   - `anchorId`       = QUÉ COMENTARIO SIEMBRA EL HILO (el ancla, o sea con cuál
//                        se entró). Siembra la query y la `key` de CommentThread.
// Si la `key` siguiera al id de la URL, cada movimiento remontaría el hilo y
// dispararía un refetch con su flash de "Cargando...": exactamente lo que no se
// quiere. Al desacoplarlos, moverse por el hilo es puro cambio de URL.
export function CommentPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  // El ancla arranca en el id de la URL y solo cambia cuando la navegación es de
  // verdad (una notificación a otro comentario), no cuando la escribimos nosotros.
  const [anchorId, setAnchorId] = useState(id)
  // Último id que pusimos nosotros en la URL al movernos dentro del hilo. Se setea
  // al navegar y se limpia al re-sembrar.
  const selfNavRef = useRef(null)

  const { data: chain, isLoading, isError } = useQuery({
    queryKey: ['comment', anchorId],
    queryFn: () => apiGet(`/replies/${anchorId}/context`).then(r => r.data),
  })

  // Re-siembra: la URL cambió a un comentario que no es el ancla NI uno que hayamos
  // escrito nosotros → es una navegación externa (notificación, link, Adelante del
  // navegador) y corresponde remontar el hilo en el comentario nuevo, con su
  // "Cargando..." legítimo.
  //
  // Por qué un ref y no `location.state.threadMove`: el state viaja pegado a la
  // entrada del historial, así que sobrevive a cosas que deberían invalidarlo.
  // Parado en B (URL /comment/B, ancla A) el usuario abre una notificación a
  // /comment/D (push) → re-sembramos en D y limpiamos el ref; si aprieta Atrás
  // vuelve a /comment/B, cuya entrada TODAVÍA trae threadMove: con el state
  // quedaría mostrando D con la URL diciendo B. Con el ref ya en null, re-siembra
  // en B y vista y URL quedan sincronizadas.
  useEffect(() => {
    if (id === anchorId) return
    if (selfNavRef.current === id) return
    selfNavRef.current = null
    setAnchorId(id)
  }, [id, anchorId])

  // Cada vez que CommentThread cambia de posición, la URL lo sigue. `replace` y no
  // `push`: así todo el paseo por el hilo ocupa UNA sola entrada de historial que se
  // reescribe en el lugar, la entrada anterior sigue siendo de donde vino el usuario
  // (feed, notificación) y el onExit → navigate(-1) lo devuelve ahí en vez de
  // caminar el hilo comentario por comentario hacia atrás.
  const handlePositionChange = useCallback((comment) => {
    if (!comment?.id) return
    const pid = String(comment.id)
    if (pid === id) return
    selfNavRef.current = pid
    // threadMove marca la transición para que ScrollToTop no la trate como una
    // navegación de verdad y no mande la página al tope (ver ScrollToTop.jsx).
    navigate(`/comment/${pid}`, { replace: true, state: { threadMove: true } })
  }, [navigate, id])

  // La cadena viene ordenada por profundidad DESC: el comentario pedido es el
  // último. De él sale el ámbito (tema/categoría) para el título, con el mismo
  // formato del servidor ("Comentario en <contexto> · UdelarHITS"). Si el
  // comentario no existe/está oculto → título genérico.
  //
  // El título NO se recalcula al moverse por el hilo, y no es un olvido: depende
  // solo del ámbito (tema/categoría), que es el mismo para toda la cadena. Encima
  // los comentarios que llegan por /replies/:id/replies no traen tema_titulo (solo
  // los trae /context), así que usar la posición actual degradaría el título a
  // genérico. Efecto colateral aceptado: como useDocumentTitle reporta page_view
  // por pathname, cada comentario visitado dentro del hilo emite uno con el mismo
  // título — son permalinks distintos realmente vistos, así que es correcto.
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
        // Todo lo que siembra el hilo va contra el ANCLA, nunca contra el id de la
        // URL: la key para no remontar en cada movimiento, el highlight para que el
        // flash marque el comentario con el que se entró (con el id de la URL, el
        // efecto de highlight haría scrollIntoView en cada paso = saltos de scroll),
        // y las invalidate keys porque ['comment', anchorId] es la única query
        // realmente cacheada (contra el id de la URL se invalidaría una entrada
        // inexistente y responder/eliminar dejaría la cadena de ancestros stale).
        key={anchorId}
        comments={[]}
        initialStack={chain}
        initialHighlightId={anchorId}
        onExit={() => navigate(-1)}
        onPositionChange={handlePositionChange}
        invalidateKey={['comment', anchorId]}
        // Al responder o eliminar en el permalink: refrescar el hilo (['replies']
        // cubre la lista de hijos en cualquier nivel), el contexto que carga esta
        // página, y el contador de respuestas del feed del Home.
        invalidateKeys={[['replies'], ['comment', anchorId], HOME_FEED_KEY]}
        embedVideos
      />
    </div>
  )
}
