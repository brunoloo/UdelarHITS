import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'
import { CategoryCard } from '../../components/shared/CategoryCard'
import { CreateCategoryPanel } from '../category/CreateCategoryPanel'
import { parseEtiquetas, normSearch as norm } from '../../utils/parseEtiquetas'
import './feed.css'

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

export function FeedPage() {
  const [searchParams] = useSearchParams()
  const qParam = searchParams.get('q')

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
  // (el doble-fetch que el enabled original vino a evitar). La coherencia entre
  // sesiones la garantiza AuthContext, que hace queryClient.clear() en
  // login/logout/verifyEmail → el feed se refetchea con la cookie nueva. El
  // resto de los setUser (editar perfil, settings, socket) son del MISMO
  // usuario, no cambian la personalización.
  const {
    data: feedData,
    isLoading: loadingFeed,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['categories', 'feed'],
    queryFn: ({ pageParam }) =>
      apiGet(`/categories/feed?limit=${PAGE_SIZE}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`),
    initialPageParam: null,
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    enabled: !qParam,
  })

  // Búsqueda (?q=): filtra client-side sobre la lista completa, como antes.
  const { data: allCategories = [], isLoading: loadingAll } = useQuery({
    queryKey: ['categories', 'active'],
    queryFn: () => apiGet('/categories/active').then(r => r.data),
    enabled: !!qParam,
    staleTime: 5 * 60 * 1000,
  })

  // Catálogo de etiquetas: viene sembrado por schema.sql, casi nunca cambia.
  const { data: allTagsGrouped = {} } = useQuery({
    queryKey: ['categories', 'etiquetas'],
    queryFn: () => apiGet('/categories/etiquetas').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  // Sentinel del infinite scroll: al entrar al viewport pide la página siguiente.
  const sentinelRef = useRef(null)
  useEffect(() => {
    if (qParam || !hasNextPage) return
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage()
    }, { rootMargin: '400px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [qParam, hasNextPage, isFetchingNextPage, fetchNextPage])

  const allTagNames = Object.values(allTagsGrouped).flat().map(t => t.nombre)

  // El feed ahora arranca en el mount, así que loadingFeed ya cubre el estado
  // inicial (antes hacía falta authLoading acá porque el query esperaba a auth).
  const isLoading = qParam ? loadingAll : loadingFeed
  const displayCategories = qParam
    ? allCategories.filter(c =>
        parseEtiquetas(c.etiquetas).some(e => norm(e) === norm(qParam)) ||
        norm(c.titulo).includes(norm(qParam))
      )
    : (feedData?.pages ?? []).flatMap(p => p.data)

  function emptyMessage() {
    if (!qParam) return 'No se encontraron categorías.'
    const isKnownTag = allTagNames.some(t => norm(t) === norm(qParam))
    if (isKnownTag) return `Todavía no hay categorías con la etiqueta "${qParam}".`
    return `No se encontraron categorías para "${qParam}".`
  }

  return (
    <div className="feed-page">
      <CreateCategoryPanel />

      <div className="categories-feed">
        {isLoading ? (
          <>
            <CategorySkeleton />
            <CategorySkeleton />
            <CategorySkeleton />
          </>
        ) : displayCategories.length === 0 ? (
          <div className="feed-empty">{emptyMessage()}</div>
        ) : (
          <>
            {/* priority solo en el primer card: su adjunto es el candidato LCP
                del Home → carga eager + fetchpriority=high, el resto lazy. */}
            {displayCategories.map((c, i) => (
              <CategoryCard key={c.id} category={c} priority={i === 0} />
            ))}
            {!qParam && (
              <div ref={sentinelRef}>
                {isFetchingNextPage && <CategorySkeleton />}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
