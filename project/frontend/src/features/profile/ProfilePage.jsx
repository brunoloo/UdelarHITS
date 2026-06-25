import { useState, useEffect, useRef } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { apiGet, apiPost } from '../../api/client'
import { Skeleton } from '../../components/ui/Skeleton'
import { UserAvatar } from '../../components/shared/UserAvatar'
import { FollowButton } from '../../components/shared/FollowButton'
import { DropdownMenu } from '../../components/ui/DropdownMenu'
import { CategoryCardMini } from '../../components/shared/CategoryCardMini'
import { TopicCardMini } from '../../components/shared/TopicCardMini'
import { CommentCard } from '../../components/shared/CommentCard'
import { BioText } from '../../utils/renderBioWithLinks'
import { EditProfileModal } from './EditProfileModal'
import { FollowersModal } from './FollowersModal'
import { ReportUserModal } from './ReportUserModal'
import './profile.css'

function ProfileSkeleton() {
  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-banner-wrap">
          <div className="profile-banner" />
          <div className="profile-avatar-wrap">
            <Skeleton width={88} height={88} borderRadius="50%" />
          </div>
        </div>
        <div className="profile-info" style={{ marginTop: 56 }}>
          <Skeleton width="40%" height={18} style={{ marginBottom: 8 }} />
          <Skeleton width="25%" height={13} style={{ marginBottom: 12 }} />
          <Skeleton width="80%" height={13} style={{ marginBottom: 6 }} />
          <Skeleton width="60%" height={13} />
        </div>
      </div>
    </div>
  )
}

export function ProfilePage() {
  const { nickname } = useParams()
  const { user: me, loading: authLoading } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  // Require a session to view profiles. Wait for auth to resolve so an
  // authenticated user reloading on /user/:nickname isn't wrongly bounced.
  // A ref ensures the toast + redirect fire exactly once, so an unstable
  // showToast identity can't re-trigger and cause a redirect loop.
  const redirectedRef = useRef(false)
  useEffect(() => {
    if (!authLoading && !me && !redirectedRef.current) {
      redirectedRef.current = true
      showToast('Debes iniciar sesión para ver el perfil de otros usuarios', 'error')
      navigate('/login', { replace: true, state: { from: location.pathname } })
    }
  }, [authLoading, me, navigate, showToast, location.pathname])

  const [activeTab, setActiveTab] = useState('categorias')
  const [editOpen, setEditOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [followModal, setFollowModal] = useState(null)
  const [avatarModalOpen, setAvatarModalOpen] = useState(false)

  const isOwnProfile = me && me.nickname === nickname
  const profileQueryKey = isOwnProfile ? ['me'] : ['user', nickname]

  const { data: profileData, isLoading, isError } = useQuery({
    queryKey: profileQueryKey,
    queryFn: () =>
      isOwnProfile
        ? apiGet('/users/me').then(r => r.data)
        : apiGet(`/users/${encodeURIComponent(nickname)}`).then(r => r.data),
    enabled: !!me,
  })

  const profile = profileData?.user
  const followers = profileData?.followers || []
  const following = profileData?.following || []
  const categories = profileData?.categories || []

  const { data: myData } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiGet('/users/me').then(r => r.data),
    enabled: !!me && !isOwnProfile,
  })

  const myFollowing = isOwnProfile ? following : (myData?.following || [])

  const { data: topics = [] } = useQuery({
    queryKey: ['topics', 'user', profile?.id],
    queryFn: () => apiGet(`/topics/user/${profile.id}`).then(r => r.data),
    enabled: !!profile && canView(),
  })

  const { data: replies = [] } = useQuery({
    queryKey: ['replies', 'user', profile?.id],
    queryFn: () => apiGet(`/replies/user/${profile.id}`).then(r => r.data),
    enabled: !!profile && canView(),
  })

  // Permite responder un comentario directamente desde la tab de comentarios
  // (la CommentCard completa incluye el botón "Responder"). Crea una respuesta
  // anidada y refresca el feed del perfil. Debe declararse antes de cualquier
  // early return para no romper el orden de los hooks.
  const replyMutation = useMutation({
    mutationFn: ({ parentId, cuerpo }) =>
      apiPost('/replies/create', { cuerpo, comentario_padre_id: parentId }),
    onSuccess: () => {
      showToast('Respuesta publicada', 'success')
      queryClient.invalidateQueries({ queryKey: ['replies', 'user', profile?.id] })
    },
    onError: (err) => showToast(err.message || 'Error al publicar', 'error'),
  })

  const handleReply = (parentId, text) =>
    replyMutation.mutateAsync({ parentId, cuerpo: text })

  function canView() {
    if (!profile) return false
    if (profile.estado === 'inactivo') return false
    if (!profile.privado) return true
    if (isOwnProfile) return true
    if (me?.rol === 'admin') return true
    return followers.some(f => f.nickname === me?.nickname)
  }

  const canViewContent = canView()

  // While auth resolves, show a skeleton (never block header/leftnav, which
  // live outside the outlet). Guests fall through to the same skeleton while
  // the redirect effect sends them to /login.
  if (authLoading || !me) return <ProfileSkeleton />
  if (isLoading) return <ProfileSkeleton />
  if (isError || !profile) return <div className="feed-empty">Perfil no encontrado.</div>

  if (profile.estado === 'inactivo') {
    return (
      <div className="profile-page">
        <div className="profile-card">
          <div className="cat-inactive-banner" style={{ padding: '40px 20px', textAlign: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div className="cat-inactive-text">
              <span className="cat-inactive-title">Este perfil no está disponible</span>
              <span className="cat-inactive-desc">El contenido publicado se mantiene visible.</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const nSeguidores = followers.length
  const nSeguidos = following.length
  const fecha = new Date(profile.fecha_creacion).toLocaleDateString('es-UY', { month: 'long', year: 'numeric' })

  // Comes straight from the profile payload, so it's available the moment the
  // card renders — the follow button shows the right state on first paint.
  // 'aceptado' | 'pendiente' | 'none'
  const miEstadoSeguimiento = profileData?.mi_estado_seguimiento ?? 'none'

  // "Te sigue" means the profile user follows ME — i.e. I (me) appear in the
  // profile user's *following* list. (Not their followers list, which would
  // instead mean that *I* follow *them*.)
  const teSigue = !isOwnProfile && me && following.some(f => f.nickname === me.nickname)

  const menuItems = []
  if (!isOwnProfile) {
    menuItems.push({
      label: 'Reportar usuario',
      icon: (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
          <line x1="4" y1="22" x2="4" y2="15"/>
        </svg>
      ),
      danger: true,
      onClick: () => setReportOpen(true),
    })
  }

  function handleFollowToggle() {
    queryClient.invalidateQueries({ queryKey: profileQueryKey })
  }

  const privateMessage = (
    <div className="empty-panel" style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '32px 16px' }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginBottom: 8 }}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>
        Esta cuenta es privada. Solo sus seguidores pueden ver su contenido.
      </p>
    </div>
  )

  return (
    <div className="profile-page">
      <div className="profile-card">
        {/* Banner + avatar */}
        <div className="profile-banner-wrap">
          <div className="profile-banner">
            {profile.url_banner && (
              <img className="profile-banner-img" src={profile.url_banner} alt="Banner" />
            )}
          </div>
          <div className="profile-avatar-wrap">
            <UserAvatar
              className="profile-avatar"
              url_imagen={profile.url_imagen}
              nickname={profile.nickname}
              size={88}
              onClick={() => setAvatarModalOpen(true)}
            />
          </div>
          {!isOwnProfile && menuItems.length > 0 && (
            <div className="profile-menu-wrap">
              <DropdownMenu items={menuItems} />
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="profile-actions">
          {isOwnProfile ? (
            <button className="btn-ghost" type="button" onClick={() => setEditOpen(true)}>
              Editar perfil
            </button>
          ) : me && (
            <FollowButton
              key={`${nickname}:${miEstadoSeguimiento}`}
              nickname={nickname}
              initialState={miEstadoSeguimiento}
              onToggle={handleFollowToggle}
            />
          )}
        </div>

        {/* Info */}
        <div className="profile-info">
          <p className="profile-name">{profile.nombre}</p>
          <div className="profile-handle-row">
            <p className="profile-handle">@{profile.nickname}</p>
            {teSigue && <span className="follow-badge">Te sigue</span>}
          </div>
          {profile.biografia && (
            <p className="profile-bio">
              <BioText text={profile.biografia} />
            </p>
          )}
          <p className="profile-fecha">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: -2 }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {' '}Se unió a la comunidad · {fecha}
          </p>
          <div className="profile-social-row">
            <button
              className="profile-social-btn"
              type="button"
              onClick={() => canViewContent && setFollowModal('seguidores')}
              style={!canViewContent ? { pointerEvents: 'none' } : undefined}
            >
              <strong>{canViewContent ? nSeguidores : '—'}</strong>{' '}
              {nSeguidores === 1 ? 'Seguidor' : 'Seguidores'}
            </button>
            <button
              className="profile-social-btn"
              type="button"
              onClick={() => canViewContent && setFollowModal('seguidos')}
              style={!canViewContent ? { pointerEvents: 'none' } : undefined}
            >
              <strong>{canViewContent ? nSeguidos : '—'}</strong>{' '}
              {nSeguidos === 1 ? 'Seguido' : 'Seguidos'}
            </button>
          </div>
        </div>
      </div>

      {/* Avatar modal */}
      {avatarModalOpen && (
        <div className="avatar-modal open" onClick={() => setAvatarModalOpen(false)}>
          <button className="avatar-modal-close" type="button" onClick={() => setAvatarModalOpen(false)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
          <UserAvatar
            className="avatar-modal-img"
            url_imagen={profile.url_imagen}
            nickname={profile.nickname}
            size={320}
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}

      {/* Tabs */}
      <nav className="section-tabs" role="tablist">
        <button
          className={`tab${activeTab === 'categorias' ? ' active' : ''}`}
          role="tab"
          onClick={() => setActiveTab('categorias')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
          </svg>
          Categorías <span className="count">{canViewContent ? categories.length : '—'}</span>
        </button>
        <button
          className={`tab${activeTab === 'temas' ? ' active' : ''}`}
          role="tab"
          onClick={() => setActiveTab('temas')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6h16M4 12h16M4 18h10"/>
          </svg>
          Temas <span className="count">{canViewContent ? topics.length : '—'}</span>
        </button>
        <button
          className={`tab${activeTab === 'comentarios' ? ' active' : ''}`}
          role="tab"
          onClick={() => setActiveTab('comentarios')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Comentarios <span className="count">{canViewContent ? replies.length : '—'}</span>
        </button>
      </nav>

      {/* Tab panels */}
      {activeTab === 'categorias' && (
        <section className="section-panel active">
          {!canViewContent ? privateMessage : categories.length === 0 ? (
            <div className="empty-panel">Sin categorías aún</div>
          ) : (
            <div className="cat-grid">
              {categories.map(c => (
                <CategoryCardMini key={c.id} category={c} />
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'temas' && (
        <section className="section-panel active">
          {!canViewContent ? privateMessage : topics.length === 0 ? (
            <div className="empty-panel">Sin temas aún</div>
          ) : (
            <div className="profile-feed-list">
              {topics.map(t => (
                <div key={t.id} className="profile-feed-item">
                  <div className="item-head">
                    <span>en categoría</span>
                    {t.categoria_estado === 'inactiva'
                      ? <span className="item-head-inactive">inactiva</span>
                      : <Link to={`/category/${encodeURIComponent(t.categoria_id)}`}>{t.categoria_titulo}</Link>}
                  </div>
                  <TopicCardMini topic={t} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'comentarios' && (
        <section className="section-panel active">
          {!canViewContent ? privateMessage : replies.length === 0 ? (
            <div className="empty-panel">Sin comentarios aún</div>
          ) : (
            <div className="profile-feed-list">
              {replies.map(r => {
                // Base del destino. Para comentarios en categoría abrimos su tab
                // de comentarios; si no, el drill-down no encuentra el comentario.
                const base = r.tipo === 'tema'
                  ? `/topic/${encodeURIComponent(r.destino_id)}`
                  : `/category/${encodeURIComponent(r.destino_id)}?tab=comentarios`
                const sep = base.includes('?') ? '&' : '?'
                // Click en la card → deep-link al comentario propio en su contexto.
                const commentHref = `${base}${sep}commentId=${encodeURIComponent(r.id)}`

                // Header contextual según el tipo de comentario:
                //  - respuesta a otro comentario → "en respuesta al comentario de [nick]"
                //  - directo a un tema           → "en tema [titulo]"
                //  - directo a una categoría     → "en categoría [titulo]"
                const isReply = !!r.comentario_padre_id
                let prefix, titleText, titleHref
                if (isReply) {
                  prefix = 'en respuesta al comentario de'
                  titleText = r.padre_autor_nickname || 'usuario'
                  // El nickname enlaza al perfil del autor del comentario padre.
                  titleHref = r.padre_autor_nickname
                    ? `/user/${encodeURIComponent(r.padre_autor_nickname)}`
                    : null
                } else if (r.tipo === 'tema') {
                  prefix = 'en tema'
                  if (r.tema_estado === 'inactivo') { titleText = 'inactivo'; titleHref = null }
                  else { titleText = r.destino_titulo; titleHref = base }
                } else {
                  prefix = 'en categoría'
                  if (r.categoria_estado === 'inactiva') { titleText = 'inactiva'; titleHref = null }
                  else { titleText = r.destino_titulo; titleHref = base }
                }

                return (
                  <div key={r.id} className="profile-feed-item">
                    <div className="item-head">
                      <span>{prefix}</span>
                      {titleHref
                        ? <Link to={titleHref}>{titleText}</Link>
                        : <span className="item-head-inactive">{titleText}</span>}
                    </div>
                    <CommentCard
                      comment={r}
                      role="reply"
                      onCardClick={() => navigate(commentHref)}
                      onReply={handleReply}
                      invalidateKey={['replies', 'user', profile.id]}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* Edit profile modal */}
      <EditProfileModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        profile={profile}
        onSaved={() => queryClient.invalidateQueries({ queryKey: profileQueryKey })}
      />

      {/* Followers/following modal */}
      <FollowersModal
        isOpen={!!followModal}
        onClose={() => setFollowModal(null)}
        title={followModal === 'seguidores' ? 'Seguidores' : 'Siguiendo'}
        users={followModal === 'seguidores' ? followers : following}
        myFollowing={myFollowing}
        onFollowChange={handleFollowToggle}
      />

      {/* Report user modal */}
      <ReportUserModal
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        nickname={nickname}
      />
    </div>
  )
}
