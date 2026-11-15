import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate, Navigate } from 'react-router-dom'
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiGet, apiPost, apiDelete } from '../../api/client'
import { HOME_FEED_KEY, COMMUNITY_STATS_KEY } from '../../api/queryKeys'
import { CategoryCard } from '../../components/shared/CategoryCard'
import { CommentCard } from '../../components/shared/CommentCard'
import { PinHomeModal } from '../../components/shared/PinHomeModal'
import { HomeComposer } from './HomeComposer'
import { CommunityStrip } from '../../components/shared/CommunityStrip'
import { buildReplyFormData } from '../../utils/attachments'
import { trackCreateComment } from '../../utils/analytics'
import { homeFeedPath } from '../../utils/homeFeedPath'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { facultadBySigla } from '../../config/facultades'
import './feed.css'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

const PAGE_SIZE = 20

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
  useDocumentTitle()
  const [searchParams] = useSearchParams()
  const qParam = searchParams.get('q')
  const etiquetaParam = searchParams.get('etiqueta')
  // Un ?q= de un link viejo se redirige a /search conservando la etiqueta; el inicio solo filtra por etiqueta.
  const redirectToSearch = !!qParam
  const isFiltering = !!etiquetaParam && !qParam
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { showToast } = useToast()
  const { user } = useAuth()
  const isAdmin = user?.rol === 'admin'

  // `pinTarget` guarda el comentario elegido mientras el modal pide la duración.
  const [pinTarget, setPinTarget] = useState(null)

  const pinHomeMutation = useMutation({
    mutationFn: ({ id, dias }) => apiPost(`/replies/${id}/pin-home`, { dias }),
    onSuccess: () => {
      showToast('Comentario fijado en el inicio', 'success')
      setPinTarget(null)
      queryClient.invalidateQueries({ queryKey: HOME_FEED_KEY })
    },
    onError: (err) => showToast(err.message || 'No se pudo fijar el comentario', 'error'),
  })

  const unpinHomeMutation = useMutation({
    mutationFn: (id) => apiDelete(`/replies/${id}/pin-home`),
    onSuccess: () => {
      showToast('Comentario desanclado del inicio', 'success')
      queryClient.invalidateQueries({ queryKey: HOME_FEED_KEY })
    },
    onError: (err) => showToast(err.message || 'No se pudo desanclar el comentario', 'error'),
  })

  // El hilo completo vive en /comment/:id; acá se publica la respuesta y se refresca el feed.
  async function handleHomeReply(parentId, text, files, poll) {
    const res = await apiPost('/replies/create',
      buildReplyFormData({ cuerpo: text, comentario_padre_id: parentId }, files, poll))
    trackCreateComment('reply')
    if (res?.data?.advertencia) showToast(res.data.advertencia, 'error')
    else showToast('Respuesta publicada', 'success')
    queryClient.invalidateQueries({ queryKey: HOME_FEED_KEY })
    return res
  }

  // Se dispara al montar, en paralelo con /users/me: el endpoint personaliza con la cookie, sin
  // esperar a AuthContext. La queryKey es fija: si llevara el id del usuario, el feed se pediría
  // dos veces al resolver la sesión. AuthContext la invalida en login, logout y verificación.
  const {
    data: feedData,
    isLoading: loadingFeed,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: HOME_FEED_KEY,
    // Página 1 con datos en cache → reenvía la `visita` (ver utils/homeFeedPath).
    queryFn: ({ pageParam }) =>
      apiGet(homeFeedPath(PAGE_SIZE, pageParam, queryClient.getQueryData(HOME_FEED_KEY))),
    initialPageParam: null,
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    enabled: !isFiltering && !redirectToSearch,
  })

  // El filtro por etiqueta lo resuelve el backend.
  const { data: allCategories = [], isLoading: loadingAll } = useQuery({
    queryKey: ['categories', 'active', etiquetaParam ?? null],
    queryFn: () =>
      apiGet(`/categories/active${etiquetaParam ? `?etiqueta=${encodeURIComponent(etiquetaParam)}` : ''}`)
        .then(r => r.data),
    enabled: isFiltering,
    staleTime: 5 * 60 * 1000,
  })

  // Sentinel del scroll infinito.
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

  // Con etiqueta se muestra el listado filtrado por el backend; sin filtros, el feed paginado.
  const isLoading = isFiltering ? loadingAll : loadingFeed
  const displayCategories = isFiltering
    ? allCategories
    : (feedData?.pages ?? []).flatMap(p => p.data)

  // El mensaje muestra la etiqueta como la buscó el usuario (la sigla), no el nombre completo.
  const etiquetaLabel = etiquetaParam
    ? (facultadBySigla(etiquetaParam) ? etiquetaParam.toUpperCase() : etiquetaParam)
    : null

  function emptyMessage() {
    if (etiquetaParam) return `Todavía no hay categorías que incluyan la etiqueta ${etiquetaLabel}`
    return 'No se encontraron categorías.'
  }

  // replace: no agrega una entrada al historial.
  if (redirectToSearch) {
    const p = new URLSearchParams()
    p.set('q', qParam)
    if (etiquetaParam) p.set('etiqueta', etiquetaParam)
    return <Navigate to={`/search?${p.toString()}`} replace />
  }

  return (
    <div className="feed-page">
      <HomeComposer />
      <CommunityStrip />

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
            {/* La key lleva el tipo: los ids de categoría y de comentario son secuencias independientes. priority solo en la primera card, cuyo adjunto es el candidato a LCP. */}
            {displayCategories.map((c, i) => (
              c.tipo === 'comentario' ? (
                <CommentCard
                  key={`comentario-${c.id}`}
                  comment={c}
                  role="reply"
                  onCardClick={() => navigate(`/comment/${c.id}`)}
                  onReply={handleHomeReply}
                  invalidateKey={HOME_FEED_KEY}
                  invalidateKeys={[COMMUNITY_STATS_KEY]}
                  canPinHome={isAdmin}
                  onPinHome={(comment) => setPinTarget(comment)}
                  onUnpinHome={(comment) => unpinHomeMutation.mutate(comment.id)}
                  embedVideos
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

      {isAdmin && (
        <PinHomeModal
          isOpen={!!pinTarget}
          onClose={() => setPinTarget(null)}
          onConfirm={(dias) => pinTarget && pinHomeMutation.mutate({ id: pinTarget.id, dias })}
          isPending={pinHomeMutation.isPending}
          desc="El comentario aparecerá primero en el inicio para todos los usuarios durante el tiempo elegido. Al vencer, se desancla automáticamente."
        />
      )}
    </div>
  )
}
