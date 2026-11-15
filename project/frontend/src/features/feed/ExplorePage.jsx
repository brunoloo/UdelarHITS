import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../hooks/useAuth'
import { apiGet, apiPost } from '../../api/client'
import { UserAvatar } from '../../components/shared/UserAvatar'
import { CategoryCardMini } from '../../components/shared/CategoryCardMini'
import { parseEtiquetas } from '../../utils/parseEtiquetas'
import { timeAgo } from '../../utils/timeAgo'
import { categoryStats } from '../../utils/categoryStats'
import { ventanaTexto, heroLabel, temaLabel, conversacionLabel } from '../../utils/ventana'
import { resolveAutor } from '../../utils/resolveAutor'
import { commentPermalink } from '../../utils/commentPermalink'
import { useToast } from '../../hooks/useToast'
import './feed.css'
import './explore.css'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

function HeroCard({ category, ventanaDias }) {
  const navigate = useNavigate()
  const allEtiquetas = parseEtiquetas(category.etiquetas)
  const etiquetas = allEtiquetas.slice(0, 5)
  const extraCount = allEtiquetas.length - 5
  // Solo comentarios de primer nivel directos a la categoría. En el histórico se
  // muestran los totales.
  const stats = ventanaDias == null
    ? categoryStats(category.contador_temas, category.contador_comentarios)
    : categoryStats(category.temas_recientes, category.comentarios_directos_recientes)
  return (
    <Link className="hero-card" to={`/category/${encodeURIComponent(category.id)}`}>
      <div className="hero-label">{heroLabel(ventanaDias)}</div>
      <div className="hero-title">{category.titulo}</div>
      {category.descripcion && <div className="hero-desc">{category.descripcion}</div>}
      {stats && (
        <div className="hero-stats">
          <span>{stats}{ventanaDias == null ? '' : ` ${ventanaTexto(ventanaDias)}`}</span>
        </div>
      )}
      {etiquetas.length > 0 && (
        <div className="hero-tags">
          {etiquetas.map(e => (
            <button key={e} type="button" className="hero-tag hero-tag--link"
              onClick={ev => { ev.preventDefault(); navigate(`/?etiqueta=${encodeURIComponent(e)}`) }}>
              {e}
            </button>
          ))}
          {extraCount > 0 && <span className="hero-tag hero-tag--more">+{extraCount} más</span>}
        </div>
      )}
    </Link>
  )
}

// "3 comentarios esta semana"; en el histórico, sin sufijo.
function conteoEnVentana(n, singular, plural, ventanaDias) {
  const base = `${n} ${n === 1 ? singular : plural}`
  return ventanaDias == null ? base : `${base} ${ventanaTexto(ventanaDias)}`
}

function TrendingSection({ topic, ventanaDias }) {
  const totalComentarios = Number(topic.total_comentarios) || 0
  const previews = topic.comentarios_preview || []
  const topicId = topic.id || topic.contenido_id
  return (
    <div className="explore-section">
      <div className="explore-section-header">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span className="explore-section-title">{temaLabel(ventanaDias)}</span>
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
          <span>{conteoEnVentana(totalComentarios, 'comentario', 'comentarios', ventanaDias)}</span>
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

// Hilo de comentarios (de Home o de una categoría) con más respuestas en la ventana.
function ConversationSection({ thread, ventanaDias }) {
  const autor = resolveAutor(thread)
  const respuestas = Number(thread.respuestas_recientes) || 0
  const previews = thread.respuestas_preview || []
  const url = commentPermalink({ tipo: thread.tipo, id: thread.id, destino_id: thread.destino_id })
  return (
    <div className="explore-section">
      <div className="explore-section-header">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 8h2a2 2 0 0 1 2 2v9l-3-3h-7a2 2 0 0 1-2-2v-1"/>
          <path d="M15 3H5a2 2 0 0 0-2 2v10l3-3h9a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/>
        </svg>
        <span className="explore-section-title">{conversacionLabel(ventanaDias)}</span>
      </div>
      <div className="trending-card">
        <div className="trending-meta">
          {thread.tipo === 'categoria' ? (
            <Link to={`/category/${encodeURIComponent(thread.destino_id)}`}>{thread.destino_titulo}</Link>
          ) : (
            <span>Inicio</span>
          )}
          <span>·</span>
          <span>{timeAgo(thread.fecha_creacion)}</span>
          <span>·</span>
          <span>{conteoEnVentana(respuestas, 'respuesta', 'respuestas', ventanaDias)}</span>
        </div>
        <div className="trending-comment trending-comment--root">
          <UserAvatar url_imagen={autor.url_imagen} nickname={autor.nickname} size={28} inactive={autor.isInactive} />
          <div className="trending-comment-body">
            <div className="trending-comment-author">{autor.nickname}</div>
            <div className="trending-comment-text">
              {thread.cuerpo?.trim() || (thread.tiene_adjuntos ? '[adjunto]' : '')}
            </div>
          </div>
        </div>
        {previews.length > 0 && (
          <>
            <div className="trending-comments-label">Respuestas recientes</div>
            <div className="trending-preview">
              {previews.map((p, i) => {
                const a = resolveAutor({ nickname: p.autor, url_imagen: p.autor_imagen, estado: p.autor_estado })
                return (
                  <div key={i} className="trending-comment">
                    <UserAvatar url_imagen={a.url_imagen} nickname={a.nickname} size={28} inactive={a.isInactive} />
                    <div className="trending-comment-body">
                      <div className="trending-comment-author">{a.nickname}</div>
                      <div className="trending-comment-text">{p.texto || ''}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
        <div className="trending-footer">
          <Link to={url}>Ver conversación completa →</Link>
        </div>
      </div>
    </div>
  )
}

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

function UserMiniCard({ user, onFollowed }) {
  const { showToast } = useToast()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  // El carrusel también se muestra a invitados: el clic los lleva a registrarse.
  const { user: sessionUser } = useAuth()
  const [leaving, setLeaving] = useState(false)
  const mutation = useMutation({
    mutationFn: () => apiPost(`/users/${encodeURIComponent(user.nickname)}/follow`, {}),
    // Animación de salida antes de quitar la card de la lista.
    onSuccess: () => {
      setLeaving(true)
      setTimeout(() => onFollowed(), 300)
      // Se invalidan todas las queries que leen la relación de seguimiento (sugeridos, perfil propio y ajenos).
      queryClient.invalidateQueries({ queryKey: ['users', 'suggested'] })
      queryClient.invalidateQueries({ queryKey: ['me'] })
      queryClient.invalidateQueries({ queryKey: ['user'] })
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
        onClick={() => (sessionUser ? mutation.mutate() : navigate('/register'))}
      >
        {mutation.isPending ? 'Siguiendo...' : 'Seguir'}
      </button>
    </div>
  )
}

function SuggestedUsers({ users }) {
  // Sin sesión las sugerencias son al azar: el título lo refleja.
  const { user } = useAuth()
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
        <span className="explore-section-title">
          {user ? 'Usuarios que podrías seguir' : 'Usuarios de la comunidad'}
        </span>
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

function CategorySuggestions({ allCats, myCats, title }) {
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
        <span className="explore-section-title">{title}</span>
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

export function ExplorePage() {
  useDocumentTitle()
  const { user, loading } = useAuth()

  // Rankings por ventana: cambian lento y son caros de calcular.
  const { data: popularData } = useQuery({
    queryKey: ['categories', 'popular', { limit: 1 }],
    queryFn: () => apiGet('/categories/popular?limit=1')
      .then(r => ({ items: r.data, ventanaDias: r.ventana_dias ?? null })),
    staleTime: 2 * 60 * 1000,
  })

  const { data: trending } = useQuery({
    queryKey: ['topics', 'trending'],
    queryFn: () => apiGet('/topics/trending')
      .then(r => ({ topic: r.data, ventanaDias: r.ventana_dias ?? null })),
    staleTime: 2 * 60 * 1000,
  })

  const { data: conversation } = useQuery({
    queryKey: ['replies', 'trending'],
    queryFn: () => apiGet('/replies/trending')
      .then(r => ({ thread: r.data, ventanaDias: r.ventana_dias ?? null })),
    staleTime: 2 * 60 * 1000,
  })

  // Alcanza con el índice liviano.
  const { data: allCats = [] } = useQuery({
    queryKey: ['categories', 'index'],
    queryFn: () => apiGet('/categories/index').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const { data: suggestedUsers = [] } = useQuery({
    queryKey: ['users', 'suggested'],
    // Sin `enabled`: el endpoint es público. La queryKey la invalidan AuthContext y FollowButton.
    queryFn: () => apiGet('/users/suggested?limit=12').then(r => r.data),
  })

  const { data: myCats = [] } = useQuery({
    queryKey: ['categories', 'me'],
    queryFn: () => apiGet('/categories/me').then(r => r.data),
    enabled: !!user,
  })

  const heroCat = popularData?.items?.[0] ?? null

  return (
    <div className="explore-page">
      <h1 className="explore-title">Explorar</h1>
      <p className="explore-subtitle">Descubrí lo mejor de la comunidad universitaria</p>

      {heroCat && <HeroCard category={heroCat} ventanaDias={popularData.ventanaDias} />}

      {conversation?.thread && (
        <ConversationSection thread={conversation.thread} ventanaDias={conversation.ventanaDias} />
      )}

      {trending?.topic && <TrendingSection topic={trending.topic} ventanaDias={trending.ventanaDias} />}

      {suggestedUsers.length > 0 && <SuggestedUsers users={suggestedUsers} />}

      {/* El listado es público: sin sesión se agrupa igual, solo que sin priorizar etiquetas propias. */}
      {!loading && (
        <CategorySuggestions
          allCats={allCats}
          myCats={user ? myCats : []}
          title={user ? 'Categorías para vos' : 'Categorías por etiqueta'}
        />
      )}

      {!loading && !user && (
        <div className="explore-empty explore-guest-cta">
          Creá tu cuenta para seguir categorías y recibir recomendaciones según tus intereses.
          <Link to="/register" className="explore-cta-btn">Crear cuenta</Link>
        </div>
      )}
    </div>
  )
}
