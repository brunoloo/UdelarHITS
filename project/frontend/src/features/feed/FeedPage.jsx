import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'
import { CategoryCard } from '../../components/shared/CategoryCard'
import { CreateCategoryPanel } from '../category/CreateCategoryPanel'
import { parseEtiquetas, normSearch as norm } from '../../utils/parseEtiquetas'
import { facultadBySigla } from '../../config/facultades'
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
  const etiquetaParam = searchParams.get('etiqueta')
  const isFiltering = !!qParam || !!etiquetaParam

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
    queryKey: ['categories', 'feed'],
    queryFn: ({ pageParam }) =>
      apiGet(`/categories/feed?limit=${PAGE_SIZE}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ''}`),
    initialPageParam: null,
    getNextPageParam: lastPage => lastPage.nextCursor ?? undefined,
    enabled: !isFiltering,
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

  // Catálogo de etiquetas: viene sembrado por schema.sql, casi nunca cambia.
  const { data: allTagsGrouped = {} } = useQuery({
    queryKey: ['categories', 'etiquetas'],
    queryFn: () => apiGet('/categories/etiquetas').then(r => r.data),
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

  const allTagNames = Object.values(allTagsGrouped).flat().map(t => t.nombre)

  // El feed arranca en el mount, así que loadingFeed ya cubre el estado inicial
  // (antes hacía falta authLoading acá porque el query esperaba a auth).
  // `allCategories` ya viene filtrado por etiqueta desde el backend; sobre eso
  // aplicamos el texto libre `q` (título substring OR etiqueta exacta). Sin
  // filtros, el feed paginado normal.
  const isLoading = isFiltering ? loadingAll : loadingFeed
  const displayCategories = isFiltering
    ? allCategories.filter(c =>
        !qParam ||
        parseEtiquetas(c.etiquetas).some(e => norm(e) === norm(qParam)) ||
        norm(c.titulo).includes(norm(qParam))
      )
    : (feedData?.pages ?? []).flatMap(p => p.data)

  // El mensaje muestra la etiqueta tal como la buscó el usuario (la sigla), no el
  // nombre completo de la facultad: si busca FARTES, el mensaje dice FARTES, no
  // "Artes" (que confunde). Para facultades va en mayúsculas, igual que la píldora.
  const etiquetaLabel = etiquetaParam
    ? (facultadBySigla(etiquetaParam) ? etiquetaParam.toUpperCase() : etiquetaParam)
    : null

  function emptyMessage() {
    if (etiquetaParam && !qParam) return `Todavía no hay categorías que incluyan la etiqueta ${etiquetaLabel}`
    if (!qParam) return 'No se encontraron categorías.'
    const isKnownTag = allTagNames.some(t => norm(t) === norm(qParam))
    if (etiquetaParam) return `Todavía no hay categorías que incluyan la etiqueta ${etiquetaLabel} para "${qParam}".`
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
            {/* priority solo en el primer card: su adjunto es el candidato LCP
                del Home → carga eager + fetchpriority=high, el resto lazy. */}
            {displayCategories.map((c, i) => (
              <CategoryCard key={c.id} category={c} priority={i === 0} />
            ))}
            {!isFiltering && (
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
