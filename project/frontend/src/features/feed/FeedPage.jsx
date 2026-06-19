import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { apiGet } from '../../api/client'
import { CategoryCard } from '../../components/shared/CategoryCard'
import { CreateCategoryPanel } from '../category/CreateCategoryPanel'
import { parseEtiquetas } from '../../utils/parseEtiquetas'
import './feed.css'

function norm(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

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

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories', 'active'],
    queryFn: () => apiGet('/categories/active').then(r => r.data),
  })

  const displayCategories = qParam
    ? categories.filter(c =>
        parseEtiquetas(c.etiquetas).some(e => norm(e) === norm(qParam)) ||
        norm(c.titulo).split(/\s+/).some(w => w.startsWith(norm(qParam)))
      )
    : categories

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
            {qParam
              ? `No se encontraron categorías para "${qParam}".`
              : 'No se encontraron categorías.'}
          </div>
        ) : (
          displayCategories.map(c => <CategoryCard key={c.id} category={c} />)
        )}
      </div>
    </div>
  )
}
