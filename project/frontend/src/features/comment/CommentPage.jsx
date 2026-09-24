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
  // Token de re-siembra. Existe porque re-sembrar EN EL PROPIO ANCLA es un caso
  // real (ver abajo) y ahí `anchorId` no cambia: sin el nonce la `key` no se
  // movería y CommentThread no remontaría.
  const [seedNonce, setSeedNonce] = useState(0)
  // DÓNDE ESTÁ PARADA LA VISTA (el comentario que CommentThread muestra abierto).
  // Arranca en el ancla —el hilo se siembra ahí— y se actualiza en CADA movimiento
  // reportado por CommentThread. Es contra esto, y no contra el ancla, que se
  // decide si un id nuevo en la URL es una navegación externa: el ancla es "con
  // qué se entró" y la posición es "dónde estás", que es justo lo que la feature
  // separa. Comparar contra el ancla daba falsos negativos (ancla 5, vista 7, llega
  // una notificación a 5 → parecía que ya estábamos ahí y no se re-sembraba).
  const positionRef = useRef(id)

  const { data: chain, isLoading, isError } = useQuery({
    queryKey: ['comment', anchorId],
    queryFn: () => apiGet(`/replies/${anchorId}/context`).then(r => r.data),
  })

  // Re-siembra: la URL apunta a un comentario que NO es donde está parada la vista
  // → alguien movió la URL sin pasar por el hilo (notificación, link interno,
  // Atrás/Adelante del navegador) y corresponde remontar el hilo ahí, con su
  // "Cargando..." legítimo. Cuando el movimiento lo escribimos nosotros desde
  // handlePositionChange, la posición ya se actualizó antes de navegar, así que
  // este efecto ve `id === positionRef.current` y no hace nada: moverse por el
  // hilo sigue siendo puro cambio de URL, sin refetch ni remount.
  //
  // Por qué un ref y no `location.state.threadMove`: el state viaja pegado a la
  // entrada del historial, así que sobrevive a cosas que deberían invalidarlo.
  // Parado en B (URL /comment/B, ancla A) el usuario abre una notificación a
  // /comment/D (push) → re-sembramos en D; si aprieta Atrás vuelve a /comment/B,
  // cuya entrada TODAVÍA trae threadMove: con el state quedaría mostrando D con la
  // URL diciendo B. Con la posición en un ref (que ya quedó en D) re-siembra en B
  // y vista y URL quedan sincronizadas.
  //
  // El id nuevo puede ser el ancla misma (ancla 5, vista 7, llega una notificación
  // al comentario 5): ahí `setAnchorId` hace bailout por valor igual, y el que
  // fuerza el remount es el nonce. La query ['comment', anchorId] ya está cacheada,
  // así que ese caso remonta sin flash de "Cargando...", que es lo deseable.
  useEffect(() => {
    if (id === positionRef.current) return
    positionRef.current = id
    setAnchorId(id)
    setSeedNonce(n => n + 1)
  }, [id])

  // Cada vez que CommentThread cambia de posición, la URL lo sigue. `replace` y no
  // `push`: así todo el paseo por el hilo ocupa UNA sola entrada de historial que se
  // reescribe en el lugar, la entrada anterior sigue siendo de donde vino el usuario
  // (feed, notificación) y el onExit → navigate(-1) lo devuelve ahí en vez de
  // caminar el hilo comentario por comentario hacia atrás.
  const handlePositionChange = useCallback((comment) => {
    if (!comment?.id) return
    const pid = String(comment.id)
    // Antes del early return, SIEMPRE: la posición cambió aunque la URL ya diga eso
    // (pasa al volver al comentario que la URL venía mostrando). Si se actualizara
    // solo cuando navegamos, el ref quedaría stale y bloquearía la próxima
    // re-siembra legítima a ese id.
    positionRef.current = pid
    if (pid === id) return
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
        // El nonce acompaña al ancla en la key para que una re-siembra EN EL PROPIO
        // ancla (ancla 5, vista 7, notificación al 5) también remonte el hilo.
        key={`${anchorId}:${seedNonce}`}
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
