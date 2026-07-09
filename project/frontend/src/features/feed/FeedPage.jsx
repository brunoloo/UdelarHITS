import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
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
  const { user } = useAuth()

  // Feed del Home: paginado por cursor, personalizado si hay sesión.
  // La queryKey incluye el usuario para rearmar el feed al entrar/salir.
  const {
    data: feedData,
    isLoading: loadingFeed,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['categories', 'feed', user?.id ?? 'anon'],
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
  })

  const { data: allTagsGrouped = {} } = useQuery({
    queryKey: ['categories', 'etiquetas'],
    queryFn: () => apiGet('/categories/etiquetas').then(r => r.data),
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
            {displayCategories.map(c => <CategoryCard key={c.id} category={c} />)}
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
