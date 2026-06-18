import { useLocation, Link, useMatch } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { apiGet } from '../../api/client'
import { parseEtiquetas } from '../../utils/parseEtiquetas'
import { resolveAutor } from '../shared/AuthorDisplay'
import { UserAvatar } from '../shared/UserAvatar'
import './Sidebar.css'

const SIDEBAR_PAGES = ['/', '/recent', '/popular', '/explore']

function JoinBanner() {
  return (
    <div className="join-banner">
      <h3>Únete a UdelarHITS</h3>
      <p>Participa en la comunidad universitaria. Crea temas, comenta y conecta con otros estudiantes.</p>
      <Link to="/register" className="btn-white">Crear cuenta</Link>
      <Link to="/login" className="btn-outline-white">Iniciar sesión</Link>
    </div>
  )
}

function CommunityCard({ categoryCount, topicCount }) {
  return (
    <div className="sidebar-card">
      <div className="sidebar-card-header">Comunidad</div>
      <div className="sidebar-card-body">
        <div className="stat-row">
          <span className="stat-row-label">Categorías activas</span>
          <span className="stat-row-value">{categoryCount ?? '—'}</span>
        </div>
        {topicCount != null && (
          <div className="stat-row">
            <span className="stat-row-label">Temas recientes</span>
            <span className="stat-row-value">{topicCount}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function PopularTagsCard({ categories }) {
  const tagCount = {}
  categories.forEach(c => {
    parseEtiquetas(c.etiquetas).forEach(tag => {
      tagCount[tag] = (tagCount[tag] || 0) + 1
    })
  })
  const sorted = Object.entries(tagCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  return (
    <div className="sidebar-card">
      <div className="sidebar-card-header">Etiquetas populares</div>
      <div className="sidebar-card-body">
        {sorted.length === 0 ? (
          <span className="sidebar-empty">Sin etiquetas aún</span>
        ) : (
          <div className="sidebar-tags-wrap">
            {sorted.map(([tag, count]) => (
              <Link key={tag} to={`/?q=${encodeURIComponent(tag)}`} className="sidebar-tag">
                <span className="sidebar-tag-name">{tag}</span>
                <span className="sidebar-tag-count">{count}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function NewCatsCard({ categories }) {
  const newest = [...categories]
    .sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion))
    .slice(0, 4)

  return (
    <div className="sidebar-card">
      <div className="sidebar-card-header">Categorías nuevas</div>
      <div className="sidebar-card-body">
        {newest.length === 0 ? (
          <span className="sidebar-empty">Sin categorías aún</span>
        ) : (
          newest.map(c => (
            <Link
              key={c.id}
              to={`/category/${encodeURIComponent(c.id)}`}
              className="sidebar-cat-item"
            >
              <span className="sidebar-cat-title">{c.titulo}</span>
              <span className="sidebar-cat-count">{Number(c.contador_temas) || 0} temas</span>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}

function ActiveUsersCard() {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', 'most-active'],
    queryFn: () => apiGet('/users/most-active?limit=5').then(r => r.data),
  })

  return (
    <div className="sidebar-card">
      <div className="sidebar-card-header">Usuarios más activos</div>
      <div className="sidebar-card-body">
        {isLoading ? (
          <span className="sidebar-loading">Cargando...</span>
        ) : users.length === 0 ? (
          <span className="sidebar-empty">Sin datos aún</span>
        ) : (
          users.map((u, i) => {
            const aportes = Number(u.aportes) || 0
            return (
              <Link
                key={u.nickname}
                to={`/user/${encodeURIComponent(u.nickname)}`}
                className="sidebar-active-user"
              >
                <span className="sidebar-active-rank">{i + 1}</span>
                <UserAvatar
                  className="sidebar-active-avatar"
                  url_imagen={u.url_imagen}
                  nickname={u.nickname}
                  size={32}
                />
                <div className="sidebar-active-info">
                  <span className="sidebar-active-nickname">@{u.nickname}</span>
                  <span className="sidebar-active-count">
                    {aportes} {aportes === 1 ? 'aporte' : 'aportes'}
                  </span>
                </div>
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}

function CategorySidebarContent({ catId }) {
  const { data: cat } = useQuery({
    queryKey: ['category', catId],
    queryFn: () => apiGet(`/categories/${catId}`).then(r => r.data),
    enabled: !!catId,
  })

  const { data: replies = [] } = useQuery({
    queryKey: ['replies', 'category', catId],
    queryFn: () => apiGet(`/replies/category/${catId}`).then(r => r.data),
    enabled: !!catId,
  })

  if (!cat || cat.estado === 'inactiva') return null

  const autorDisplay = resolveAutor(cat)
  const topicCount = cat.topics?.length ?? Number(cat.contador_temas) ?? 0
  const commentCount = replies.length
  const createdDate = new Date(cat.fecha_creacion).toLocaleDateString('es-UY')

  return (
    <>
      <div className="sidebar-card">
        <div className="sidebar-card-header">Sobre esta categoría</div>
        <div className="sidebar-card-body">
          <div className="stat-row">
            <span className="stat-row-label">Temas</span>
            <span className="stat-row-value">{topicCount}</span>
          </div>
          <div className="stat-row">
            <span className="stat-row-label">Comentarios</span>
            <span className="stat-row-value">{commentCount}</span>
          </div>
          <div className="stat-row">
            <span className="stat-row-label">Creada</span>
            <span className="stat-row-value">{createdDate}</span>
          </div>
        </div>
      </div>
      <div className="sidebar-card">
        <div className="sidebar-card-header">Moderación</div>
        <div className="sidebar-card-body">
          <div className="mod-item">
            <UserAvatar
              className="mod-avatar"
              url_imagen={autorDisplay.url_imagen}
              nickname={autorDisplay.nickname}
              size={36}
              inactive={autorDisplay.isInactive}
            />
            <div className="mod-info">
              {autorDisplay.isInactive ? (
                <span className="mod-name inactive-author">{autorDisplay.nickname}</span>
              ) : (
                <span className="mod-name">
                  <Link to={`/user/${encodeURIComponent(autorDisplay.nickname)}`}>
                    {autorDisplay.nickname}
                  </Link>
                </span>
              )}
              <span className="mod-role">moderador</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export function Sidebar() {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const categoryMatch = useMatch('/category/:id')
  const catId = categoryMatch?.params?.id

  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ['categories', 'active'],
    queryFn: () => apiGet('/categories/active').then(r => r.data),
  })

  const { data: recentTopics = [] } = useQuery({
    queryKey: ['topics', 'recent'],
    queryFn: () => apiGet('/topics/recent?limit=30').then(r => r.data),
    enabled: pathname === '/recent',
  })

  if (!SIDEBAR_PAGES.includes(pathname) && !catId) return null

  if (catId) {
    return (
      <aside className="sidebar">
        <CategorySidebarContent catId={catId} />
      </aside>
    )
  }

  const categoryCount = catsLoading ? null : categories.length

  return (
    <aside className="sidebar">
      {!user && <JoinBanner />}

      {pathname === '/' && (
        <CommunityCard categoryCount={categoryCount} />
      )}

      {pathname === '/recent' && (
        <>
          <PopularTagsCard categories={categories} />
          <CommunityCard categoryCount={categoryCount} topicCount={recentTopics.length} />
        </>
      )}

      {pathname === '/popular' && (
        <>
          <NewCatsCard categories={categories} />
          <CommunityCard categoryCount={categoryCount} />
        </>
      )}

      {pathname === '/explore' && (
        <>
          <ActiveUsersCard />
          <CommunityCard categoryCount={categoryCount} />
        </>
      )}
    </aside>
  )
}
