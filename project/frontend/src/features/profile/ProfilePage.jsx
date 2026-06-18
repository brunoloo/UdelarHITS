import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { apiGet } from '../../api/client'
import { UserAvatar } from '../../components/shared/UserAvatar'
import { FollowButton } from '../../components/shared/FollowButton'
import { DropdownMenu } from '../../components/ui/DropdownMenu'
import { CategoryCard } from '../../components/shared/CategoryCard'
import { TopicCard } from '../../components/shared/TopicCard'
import { BioText } from '../../utils/renderBio'
import { EditProfileModal } from './EditProfileModal'
import { FollowersModal } from './FollowersModal'
import { ReportUserModal } from './ReportUserModal'
import './profile.css'

export function ProfilePage() {
  const { nickname } = useParams()
  const { user: me } = useAuth()
  const queryClient = useQueryClient()

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

  const { data: followStatus } = useQuery({
    queryKey: ['followStatus', nickname],
    queryFn: () => apiGet(`/users/${encodeURIComponent(nickname)}/following`).then(r => r.data),
    enabled: !!me && !isOwnProfile && !!profile && profile.estado !== 'inactivo',
  })

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

  function canView() {
    if (!profile) return false
    if (profile.estado === 'inactivo') return false
    if (!profile.privado) return true
    if (isOwnProfile) return true
    if (me?.rol === 'admin') return true
    return followers.some(f => f.nickname === me?.nickname)
  }

  const canViewContent = canView()

  if (isLoading) return <div className="feed-empty">Cargando...</div>
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

  const iFollowThem = followStatus?.following ?? false

  const teSigue = !isOwnProfile && me && followers.some(f => f.nickname === me.nickname)

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
    queryClient.invalidateQueries({ queryKey: ['followStatus', nickname] })
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
              nickname={nickname}
              initialFollowing={iFollowThem}
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
                <Link key={c.id} to={`/category/${encodeURIComponent(c.id)}`} className="cat">
                  <div className="cat-icon">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 4h12l4 4v12H4z"/><path d="M16 4v4h4"/>
                    </svg>
                  </div>
                  <div className="cat-text">
                    <div className="t">{c.titulo}</div>
                    <div className="s">{parseInt(c.contador_temas) || 0} {parseInt(c.contador_temas) === 1 ? 'tema' : 'temas'}</div>
                  </div>
                </Link>
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
            <div className="list">
              {topics.map(t => (
                <article key={t.id} className="item">
                  <div className="item-head">
                    <span>en</span>
                    <Link to={`/category/${encodeURIComponent(t.categoria_id)}`}>
                      {t.categoria_estado === 'inactiva' ? 'Categoría inactiva' : t.categoria_titulo}
                    </Link>
                  </div>
                  <h3 className="item-title">
                    <Link to={`/topic/${encodeURIComponent(t.id)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      {t.titulo}
                    </Link>
                  </h3>
                  <p className="item-body">{t.cuerpo}</p>
                </article>
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
            <div className="list">
              {replies.map(r => {
                const href = r.tipo === 'tema'
                  ? `/topic/${encodeURIComponent(r.destino_id)}`
                  : `/category/${encodeURIComponent(r.destino_id)}`

                let destinoLabel
                if (r.tipo === 'tema' && r.tema_estado === 'inactivo') {
                  destinoLabel = 'Tema inactivo'
                } else if (r.tipo === 'categoria' && r.categoria_estado === 'inactiva') {
                  destinoLabel = 'Categoría inactiva'
                } else {
                  destinoLabel = r.destino_titulo
                }

                return (
                  <article key={r.id} className="item">
                    <div className="item-head">
                      <span>en</span>
                      <Link to={href}>{destinoLabel}</Link>
                    </div>
                    <p className="item-body">{r.cuerpo}</p>
                  </article>
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
