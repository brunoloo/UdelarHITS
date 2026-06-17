import { useLocation, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { apiGet } from '../../api/client'
import { parseEtiquetas } from '../../utils/parseEtiquetas'
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
                <img
                  className="sidebar-active-avatar"
                  src={u.url_imagen || '/assets/default-user.jpg'}
                  alt=""
                  onError={e => { e.currentTarget.src = '/assets/default-user.jpg' }}
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

export function Sidebar() {
  const { user } = useAuth()
  const { pathname } = useLocation()

  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ['categories', 'active'],
    queryFn: () => apiGet('/categories/active').then(r => r.data),
  })

  const { data: recentTopics = [] } = useQuery({
    queryKey: ['topics', 'recent'],
    queryFn: () => apiGet('/topics/recent?limit=30').then(r => r.data),
    enabled: pathname === '/recent',
  })

  if (!SIDEBAR_PAGES.includes(pathname)) return null

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
