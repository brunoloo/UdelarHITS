import { useEffect, useRef } from 'react'
import { useSearchParams, useNavigate, Navigate } from 'react-router-dom'
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost } from '../../api/client'
import { CategoryCard } from '../../components/shared/CategoryCard'
import { CommentCard } from '../../components/shared/CommentCard'
import { CreateCategoryPanel } from '../category/CreateCategoryPanel'
import { CreateCommentPanel } from '../../components/shared/CreateCommentPanel'
import { buildReplyFormData } from '../../utils/attachments'
import { trackCreateComment } from '../../utils/analytics'
import { useToast } from '../../hooks/useToast'
import { facultadBySigla } from '../../config/facultades'
import './feed.css'

const PAGE_SIZE = 20

const FEED_KEY = ['categories', 'feed']
// Contador de comentarios de Home del sidebar de Comunidad: se refresca al
// publicar/eliminar un comentario de Home de primer nivel.
const HOME_COUNT_KEY = ['replies', 'home', 'count']

function CategorySkeleton() {
  return (
    <div className="skeleton-card">
      <div className="skeleton" style={{ height: 11, width: '28%', marginBottom: 10 }} />
      <div className="skeleton" style={{ height: 17, width: '65%', marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 12, width: '90%', marginBottom: 4 }} />
      <div className="skeleton" style={{ height: 12, width: '55%' }} />
    </div>
  )
}

// Skeleton del tipo comentario del feed mixto (avatar + líneas de cuerpo).
function CommentSkeleton() {
  return (
    <div className="skeleton-card skeleton-card--comment">
      <div className="skeleton skeleton--avatar" />
      <div className="skeleton-card-lines">
        <div className="skeleton" style={{ height: 11, width: '35%', marginBottom: 10 }} />
        <div className="skeleton" style={{ height: 12, width: '85%', marginBottom: 4 }} />
        <div className="skeleton" style={{ height: 12, width: '60%' }} />
      </div>
    </div>
  )
}

export function FeedPage() {
  const [searchParams] = useSearchParams()
  const qParam = searchParams.get('q')
  const etiquetaParam = searchParams.get('etiqueta')
  // El texto libre ahora vive en /search (buscador unificado por título,
  // descripción, cuerpo). Un `?q=` que llegue acá (link viejo) se redirige a
  // /search preservando la etiqueta. El Home conserva SOLO el filtro por etiqueta
  // sin texto (?etiqueta=): ese sigue siendo el listado filtrado de categorías.
  const redirectToSearch = !!qParam
  const isFiltering = !!etiquetaParam && !qParam
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  // Responder a un comentario de Home desde el feed: publica la respuesta y
  // refresca el feed (el contador de respuestas de la card se recalcula). El
  // hilo completo vive en /comment/:id (misma navegación que en categoría).
  async function handleHomeReply(parentId, text, files, poll) {
    const res = await apiPost('/replies/create',
      buildReplyFormData({ cuerpo: text, comentario_padre_id: parentId }, files, poll))
    trackCreateComment('reply')
    if (res?.data?.advertencia) showToast(res.data.advertencia, 'error')
    else showToast('Respuesta publicada', 'success')
    queryClient.invalidateQueries({ queryKey: FEED_KEY })
    return res
  }

  // Feed del Home: paginado por cursor, personalizado si hay sesión.
  //
  // Se dispara en el MOUNT, sin esperar a que AuthContext resuelva /users/me.
  // El endpoint /categories/feed usa optionalAuth (ver category.routes.js): lee
  // la cookie JWT que el navegador ya adjunta en cada request (apiGet →
  // credentials:'include') y personaliza server-side, así que no necesita que el
  // cliente sepa quién es el usuario primero. Antes, enabled esperaba authLoading
  // y la queryKey incluía user?.id, con lo que el feed (el fetch más caro)
  // quedaba SERIAL detrás de /users/me. Ahora ambos requests viajan en PARALELO
  // → un round-trip menos en la ruta crítica del LCP.
  //
  // La queryKey es FIJA (sin user?.id) a propósito: si dependiera del id, al
  // resolver auth la key cambiaría y el feed se pediría dos veces por arranque
  // (el doble-fetch que el enabled original vino a evitar). Con key fija, el
  // cambio de sesión NO rearma la query solo, así que AuthContext invalida
  // explícitamente en login/logout/verifyEmail (queryClient.invalidateQueries)
  // → el feed montado se refetchea con la cookie nueva. (clear() no alcanza: no
  // refetchea queries activas con key fija.) El resto de los setUser (editar
  // perfil, settings, socket) son del MISMO usuario, no cambian la
  // personalización.
  const {
    data: feedData,
    isLoading: loadingFeed,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: FEED_KEY,
    queryFn: ({ pageParam }) =>
      apiGet(`/categories/feed?limit=${PAGE_SIZE}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`),
    initialPageParam: null,
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    enabled: !isFiltering && !redirectToSearch,
  })

  // Búsqueda filtrada. El filtro EXACTO por etiqueta lo resuelve el backend
  // (?etiqueta=), y el texto libre `q` se aplica client-side encima —así el
  // contador y la lista salen del mismo request y ?q= mantiene su comportamiento.
  const { data: allCategories = [], isLoading: loadingAll } = useQuery({
    queryKey: ['categories', 'active', etiquetaParam ?? null],
    queryFn: () =>
      apiGet(`/categories/active${etiquetaParam ? `?etiqueta=${encodeURIComponent(etiquetaParam)}` : ''}`)
        .then(r => r.data),
    enabled: isFiltering,
    staleTime: 5 * 60 * 1000,
  })

  // Sentinel del infinite scroll: al entrar al viewport pide la página siguiente.
  const sentinelRef = useRef(null)
  useEffect(() => {
    if (isFiltering || !hasNextPage) return
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage()
    }, { rootMargin: '400px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [isFiltering, hasNextPage, isFetchingNextPage, fetchNextPage])

  // El feed arranca en el mount, así que loadingFeed ya cubre el estado inicial
  // (antes hacía falta authLoading acá porque el query esperaba a auth).
  // Con etiqueta (sin texto), `allCategories` ya viene filtrado por el backend y
  // se muestra tal cual — sin re-filtro client-side (el texto libre se fue a
  // /search). Sin filtros, el feed paginado normal.
  const isLoading = isFiltering ? loadingAll : loadingFeed
  const displayCategories = isFiltering
    ? allCategories
    : (feedData?.pages ?? []).flatMap(p => p.data)

  // El mensaje muestra la etiqueta tal como la buscó el usuario (la sigla), no el
  // nombre completo de la facultad: si busca FARTES, el mensaje dice FARTES, no
  // "Artes" (que confunde). Para facultades va en mayúsculas, igual que la píldora.
  const etiquetaLabel = etiquetaParam
    ? (facultadBySigla(etiquetaParam) ? etiquetaParam.toUpperCase() : etiquetaParam)
    : null

  function emptyMessage() {
    if (etiquetaParam) return `Todavía no hay categorías que incluyan la etiqueta ${etiquetaLabel}`
    return 'No se encontraron categorías.'
  }

  // Link viejo con ?q=: la búsqueda de texto vive en /search. Redirigimos
  // preservando la etiqueta (búsqueda combinada). replace: no ensuciar el back.
  if (redirectToSearch) {
    const p = new URLSearchParams()
    p.set('q', qParam)
    if (etiquetaParam) p.set('etiqueta', etiquetaParam)
    return <Navigate to={`/search?${p.toString()}`} replace />
  }

  return (
    <div className="feed-page">
      <CreateCategoryPanel />
      {/* Publicar un comentario de Home (foro global). Mismo compositor que
          CategoryPage; el comentario se mezcla en el feed de abajo. */}
      <CreateCommentPanel scopeFields={{ es_home: true }} invalidateKey={FEED_KEY} invalidateKeys={[HOME_COUNT_KEY]} />

      <div className="categories-feed">
        {isLoading ? (
          <>
            <CategorySkeleton />
            <CommentSkeleton />
            <CategorySkeleton />
          </>
        ) : displayCategories.length === 0 ? (
          <div className="feed-empty">
            <p className="feed-empty-msg">{emptyMessage()}</p>
            {etiquetaParam && (
              <button
                type="button"
                className="feed-empty-cta"
                onClick={() => {
                  window.scrollTo({ top: 0 })
                  window.dispatchEvent(new CustomEvent('open-create-category'))
                }}
              >
                Crear la primera
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Feed mixto: cada ítem trae un discriminador `tipo`. Los de la
                búsqueda filtrada son sólo categorías (sin `tipo`). La key lleva
                el tipo porque categoria.id y comentario.id son secuencias
                independientes y podrían colisionar. priority solo en el primer
                card: su adjunto es el candidato LCP del Home. */}
            {displayCategories.map((c, i) => (
              c.tipo === 'comentario' ? (
                <CommentCard
                  key={`comentario-${c.id}`}
                  comment={c}
                  role="reply"
                  onCardClick={() => navigate(`/comment/${c.id}`)}
                  onReply={handleHomeReply}
                  invalidateKey={FEED_KEY}
                  invalidateKeys={[HOME_COUNT_KEY]}
                />
              ) : (
                <CategoryCard key={`categoria-${c.id}`} category={c} priority={i === 0} />
              )
            ))}
            {!isFiltering && (
              <div ref={sentinelRef}>
                {isFetchingNextPage && (
                  <>
                    <CategorySkeleton />
                    <CommentSkeleton />
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
