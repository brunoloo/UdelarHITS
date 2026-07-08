import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { apiGet, apiPost } from '../../api/client'
import { UserAvatar } from '../../components/shared/UserAvatar'
import { CategoryCardMini } from '../../components/shared/CategoryCardMini'
import { parseEtiquetas } from '../../utils/parseEtiquetas'
import { timeAgo } from '../../utils/timeAgo'
import { useToast } from '../../hooks/useToast'
import './feed.css'
import './explore.css'

// ── Hero ──
function HeroCard({ category }) {
  const allEtiquetas = parseEtiquetas(category.etiquetas)
  const etiquetas = allEtiquetas.slice(0, 5)
  const extraCount = allEtiquetas.length - 5
  const temas = Number(category.temas_recientes) || 0
  const comentarios = Number(category.comentarios_recientes) || 0
  return (
    <Link className="hero-card" to={`/category/${encodeURIComponent(category.id)}`}>
      <div className="hero-label">Categoría de la semana</div>
      <div className="hero-title">{category.titulo}</div>
      {category.descripcion && <div className="hero-desc">{category.descripcion}</div>}
      <div className="hero-stats">
        <span>{temas} {temas === 1 ? 'tema' : 'temas'} esta semana</span>
        <span>·</span>
        <span>{comentarios} {comentarios === 1 ? 'comentario' : 'comentarios'}</span>
        <span>·</span>
        <span>{Number(category.contador_temas) || 0} temas en total</span>
      </div>
      {etiquetas.length > 0 && (
        <div className="hero-tags">
          {etiquetas.map(e => <span key={e} className="hero-tag">{e}</span>)}
          {extraCount > 0 && <span className="hero-tag hero-tag--more">+{extraCount} más</span>}
        </div>
      )}
    </Link>
  )
}

// ── Trending topic ──
function TrendingSection({ topic }) {
  const totalComentarios = Number(topic.total_comentarios) || 0
  const previews = topic.comentarios_preview || []
  const topicId = topic.id || topic.contenido_id
  return (
    <div className="explore-section">
      <div className="explore-section-header">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span className="explore-section-title">Tema del momento</span>
      </div>
      <div className="trending-card">
        <div className="trending-meta">
          {topic.categoria_id && (
            <Link to={`/category/${encodeURIComponent(topic.categoria_id)}`}>
              {topic.categoria_titulo}
            </Link>
          )}
          {topic.categoria_id && <span>·</span>}
          <span>{timeAgo(topic.fecha_creacion)}</span>
          <span>·</span>
          <span>{totalComentarios} {totalComentarios === 1 ? 'comentario' : 'comentarios'}</span>
        </div>
        <div className="trending-title">
          <Link to={`/topic/${encodeURIComponent(topicId)}`}>{topic.titulo}</Link>
        </div>
        {topic.cuerpo && <div className="trending-body">{topic.cuerpo}</div>}
        {previews.length > 0 && (
          <>
            <div className="trending-comments-label">Comentarios recientes</div>
            <div className="trending-preview">
              {previews.map((c, i) => (
                <div key={i} className="trending-comment">
                  <UserAvatar url_imagen={c.autor_imagen || null} nickname={c.autor} size={28} />
                  <div className="trending-comment-body">
                    <div className="trending-comment-author">{c.autor}</div>
                    <div className="trending-comment-text">{c.texto || ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="trending-footer">
          <Link to={`/topic/${encodeURIComponent(topicId)}`}>Ver conversación completa →</Link>
        </div>
      </div>
    </div>
  )
}

// ── Carousel ──
function Carousel({ children, className = '' }) {
  const trackRef = useRef(null)
  const [overflowing, setOverflowing] = useState(false)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    function update() {
      const overflow = track.scrollWidth > track.clientWidth + 1
      setOverflowing(overflow)
      setAtStart(track.scrollLeft <= 0)
      setAtEnd(track.scrollLeft + track.clientWidth >= track.scrollWidth - 1)
    }

    update()
    const observer = new ResizeObserver(update)
    observer.observe(track)
    track.addEventListener('scroll', update)

    return () => {
      observer.disconnect()
      track.removeEventListener('scroll', update)
    }
  }, [children])

  function scroll(dir) {
    trackRef.current?.scrollBy({ left: dir * 260, behavior: 'smooth' })
  }

  return (
    <div className="carousel-wrap">
      <div ref={trackRef} className={`carousel-track ${className}`}>
        {children}
      </div>
      {overflowing && (
        <>
          <button
            className="carousel-arrow carousel-arrow--left"
            type="button"
            onClick={() => scroll(-1)}
            disabled={atStart}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </button>
          <button
            className="carousel-arrow carousel-arrow--right"
            type="button"
            onClick={() => scroll(1)}
            disabled={atEnd}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </button>
        </>
      )}
    </div>
  )
}

// ── User mini card ──
function UserMiniCard({ user, onFollowed }) {
  const { showToast } = useToast()
  const [leaving, setLeaving] = useState(false)
  const mutation = useMutation({
    mutationFn: () => apiPost(`/users/${encodeURIComponent(user.nickname)}/follow`, {}),
    // Play an exit animation (fade + scale, matching the vanilla version),
    // then remove the card from the suggested list.
    onSuccess: () => {
      setLeaving(true)
      setTimeout(() => onFollowed(), 300)
    },
    onError: err => showToast(err.message || 'Error', 'error'),
  })
  return (
    <div className={`user-mini-card${leaving ? ' user-mini-card--leaving' : ''}`}>
      <Link to={`/user/${encodeURIComponent(user.nickname)}`}>
        <UserAvatar url_imagen={user.url_imagen} nickname={user.nickname} size={48} />
      </Link>
      <Link className="user-mini-nickname" to={`/user/${encodeURIComponent(user.nickname)}`}>
        @{user.nickname}
      </Link>
      <button
        className="btn-follow-sm"
        type="button"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? 'Siguiendo...' : 'Seguir'}
      </button>
    </div>
  )
}

// ── Suggested users ──
function SuggestedUsers({ users }) {
  const [dismissed, setDismissed] = useState(new Set())
  const visible = users.filter(u => !dismissed.has(u.nickname))
  if (visible.length === 0) return null

  return (
    <div className="explore-section">
      <div className="explore-section-header">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <span className="explore-section-title">Usuarios que podrías seguir</span>
      </div>
      <Carousel>
        {visible.map(u => (
          <UserMiniCard
            key={u.nickname}
            user={u}
            onFollowed={() => setDismissed(prev => new Set([...prev, u.nickname]))}
          />
        ))}
      </Carousel>
    </div>
  )
}

// ── Category suggestions by tag ──
function CategorySuggestions({ allCats, myCats }) {
  const myIds = new Set((myCats || []).map(c => c.id))
  const myTags = new Set()
  ;(myCats || []).forEach(c => parseEtiquetas(c.etiquetas).forEach(t => myTags.add(t)))

  const others = allCats.filter(c => !myIds.has(c.id))
  if (others.length === 0) return null

  const tagGroups = {}
  others.forEach(c => {
    parseEtiquetas(c.etiquetas).forEach(tag => {
      if (!tagGroups[tag]) tagGroups[tag] = []
      if (!tagGroups[tag].find(x => x.id === c.id)) tagGroups[tag].push(c)
    })
  })

  const sortedTags = Object.entries(tagGroups)
    .sort((a, b) => {
      const aMatch = myTags.has(a[0]) ? 0 : 1
      const bMatch = myTags.has(b[0]) ? 0 : 1
      if (aMatch !== bMatch) return aMatch - bMatch
      return b[1].length - a[1].length
    })
    .slice(0, 5)

  if (sortedTags.length === 0) return null

  return (
    <div className="explore-section">
      <div className="explore-section-header">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1.5"/>
          <rect x="14" y="3" width="7" height="7" rx="1.5"/>
          <rect x="3" y="14" width="7" height="7" rx="1.5"/>
          <rect x="14" y="14" width="7" height="7" rx="1.5"/>
        </svg>
        <span className="explore-section-title">Categorías para vos</span>
      </div>
      {sortedTags.map(([tag, cats]) => (
        <div key={tag} style={{ marginBottom: 16 }}>
          <div className="cat-group-label">{tag}</div>
          <Carousel>
            {cats.slice(0, 8).map(c => (
              <CategoryCardMini key={c.id} category={c} className="category-mini-card--carousel" />
            ))}
          </Carousel>
        </div>
      ))}
    </div>
  )
}

// ── Page ──
export function ExplorePage() {
  const { user, loading } = useAuth()

  const { data: popularCats = [] } = useQuery({
    queryKey: ['categories', 'popular'],
    queryFn: () => apiGet('/categories/popular?days=7&limit=1').then(r => r.data),
  })

  const { data: trending } = useQuery({
    queryKey: ['topics', 'trending'],
    queryFn: () => apiGet('/topics/trending').then(r => r.data),
  })

  const { data: allCats = [] } = useQuery({
    queryKey: ['categories', 'active'],
    queryFn: () => apiGet('/categories/active').then(r => r.data),
  })

  const { data: suggestedUsers = [] } = useQuery({
    queryKey: ['users', 'suggested'],
    queryFn: () => apiGet('/users/suggested?limit=12').then(r => r.data),
    enabled: !!user,
  })

  const { data: myCats = [] } = useQuery({
    queryKey: ['categories', 'me'],
    queryFn: () => apiGet('/categories/me').then(r => r.data),
    enabled: !!user,
  })

  const heroCat = popularCats[0] ?? null

  return (
    <div className="explore-page">
      <h1 className="explore-title">Explorar</h1>
      <p className="explore-subtitle">Descubrí lo mejor de la comunidad universitaria</p>

      {heroCat && <HeroCard category={heroCat} />}

      {trending && <TrendingSection topic={trending} />}

      {user && suggestedUsers.length > 0 && <SuggestedUsers users={suggestedUsers} />}

      {user ? (
        <CategorySuggestions allCats={allCats} myCats={myCats} />
      ) : loading ? null : (
        <div className="explore-section">
          <div className="explore-section-header">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1.5"/>
              <rect x="14" y="3" width="7" height="7" rx="1.5"/>
              <rect x="3" y="14" width="7" height="7" rx="1.5"/>
              <rect x="14" y="14" width="7" height="7" rx="1.5"/>
            </svg>
            <span className="explore-section-title">Categorías para vos</span>
          </div>
          <div className="explore-empty">
            Inicia sesión para que podamos recomendarte categorías basadas en tus intereses.
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <Link
                to="/login"
                style={{
                  display: 'inline-block',
                  marginTop: 12,
                  padding: '8px 20px',
                  background: 'var(--accent)',
                  color: 'var(--text-on-accent)',
                  borderRadius: 999,
                  textDecoration: 'none',
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Iniciar sesión
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
