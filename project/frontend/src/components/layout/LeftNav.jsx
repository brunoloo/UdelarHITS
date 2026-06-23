import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { UserAvatar } from '../shared/UserAvatar'
import { apiGet, apiPost, apiPatch, apiDelete } from '../../api/client'
import './LeftNav.css'

function notifTimeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'hace un momento'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)} d`
  return new Date(dateStr).toLocaleDateString('es-UY')
}

// Ícono distintivo por tipo de notificación.
function NotifTypeIcon({ tipo }) {
  if (tipo === 'reaccion_like') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    )
  }
  if (tipo === 'respuesta_comentario') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    )
  }
  if (tipo === 'nuevo_seguidor' || tipo === 'solicitud_seguimiento' || tipo === 'solicitud_aceptada') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="8.5" cy="7" r="4"/>
        <line x1="20" y1="8" x2="20" y2="14"/>
        <line x1="23" y1="11" x2="17" y2="11"/>
      </svg>
    )
  }
  // moderacion_contenido y demás: escudo
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}

export function LeftNav() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isAdmin = user?.rol === 'admin'

  const [panelOpen, setPanelOpen] = useState(false)
  const [notifications, setNotifications] = useState(null)
  const [notifLoading, setNotifLoading] = useState(false)
  const panelRef = useRef(null)
  const notifBtnRef = useRef(null)

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => apiGet('/notifications/unread-count').then(r => r.data?.total ?? 0),
    enabled: !!user,
    refetchInterval: 60000,
  })

  useEffect(() => {
    if (!panelOpen) return
    function handleClick(e) {
      if (
        panelRef.current && !panelRef.current.contains(e.target) &&
        notifBtnRef.current && !notifBtnRef.current.contains(e.target)
      ) {
        setPanelOpen(false)
      }
    }
    function handleKey(e) {
      if (e.key === 'Escape') setPanelOpen(false)
    }
    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [panelOpen])

  async function openPanel() {
    setPanelOpen(true)
    if (!user) {
      setNotifications([])
      return
    }
    setNotifLoading(true)
    try {
      const res = await apiGet('/notifications')
      setNotifications(res.data ?? [])
      await apiPatch('/notifications/read-all')
      queryClient.setQueryData(['notifications', 'unread-count'], 0)
    } catch {
      setNotifications([])
    } finally {
      setNotifLoading(false)
    }
  }

  function handleNotifClick(e) {
    e.preventDefault()
    e.stopPropagation()
    if (panelOpen) {
      setPanelOpen(false)
    } else {
      openPanel()
    }
  }

  async function handleDelete(notifId) {
    try {
      await apiDelete(`/notifications/${notifId}`)
      setNotifications(prev => prev.filter(n => n.id !== notifId))
    } catch {}
  }

  // Aceptar/Rechazar una solicitud de seguimiento desde el panel. En ambos casos
  // el backend consume la notificación, así que la quitamos de la lista local.
  async function handleFollowRequest(n, action) {
    if (!n.actor_nickname) return
    try {
      await apiPost(`/users/${encodeURIComponent(n.actor_nickname)}/follow/${action}`, {})
      setNotifications(prev => prev.filter(x => x.id !== n.id))
      // El perfil del solicitante puede estar abierto: refrescar contadores/estado.
      queryClient.invalidateQueries({ queryKey: ['user'] })
      queryClient.invalidateQueries({ queryKey: ['me'] })
      showToast(action === 'accept' ? 'Solicitud aceptada' : 'Solicitud rechazada', 'success')
    } catch (err) {
      showToast(err.message || 'No se pudo procesar la solicitud', 'error')
    }
  }

  // Click en una notificación con destino: navegar y cerrar el panel.
  // Las notificaciones ya se marcaron como leídas al abrir el panel (read-all).
  function handleItemClick(n) {
    if (!n.url) return
    setPanelOpen(false)
    navigate(n.url)
  }

  function navClass(path) {
    const active = path === '/' ? pathname === '/' : pathname.startsWith(path)
    return `nav-item${active ? ' active' : ''}`
  }

  return (
    <>
      <nav className="left-nav">
        <Link to="/" className={navClass('/')} id="nav-inicio">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 11 9-8 9 8"/>
            <path d="M5 10v10h14V10"/>
          </svg>
          Inicio
        </Link>

        <Link to="/explore" className={navClass('/explore')} id="nav-explorar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
          Explorar
        </Link>

        <button
          ref={notifBtnRef}
          className={`nav-item${panelOpen ? ' active' : ''}`}
          id="nav-notifications"
          onClick={handleNotifClick}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/>
            <path d="M10 21a2 2 0 0 0 4 0"/>
          </svg>
          Notificaciones
          {unreadCount > 0 && (
            <span className="notif-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </button>

        <button className="nav-item" id="nav-chat" onClick={() => showToast('El chat estará disponible próximamente', 'info')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Chat
        </button>

        <div className="nav-divider" />

        <Link to="/popular" className={navClass('/popular')} id="nav-populares">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
            <polyline points="17 6 23 6 23 12"/>
          </svg>
          Populares
        </Link>

        <Link to="/recent" className={navClass('/recent')} id="nav-recientes">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          Recientes
        </Link>

        {isAdmin && (
          <>
            <div className="nav-divider" />
            <Link to="/admin" className={navClass('/admin')} id="nav-dev">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Administración
            </Link>
          </>
        )}

        <Link to="/about" className={navClass('/about')} id="nav-about">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Quienes somos
        </Link>

        <Link to="/settings" className={`${navClass('/settings')} nav-item-bottom`} id="nav-configuration">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
          Configuración
        </Link>
      </nav>

      <div className={`notif-panel${panelOpen ? ' open' : ''}`} ref={panelRef}>
        <div className="notif-panel-head">
          <h3>Notificaciones</h3>
          <button
            className="notif-panel-close"
            type="button"
            onClick={() => setPanelOpen(false)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div className="notif-panel-body">
          {!user ? (
            <div className="notif-empty">
              <p>Iniciá sesión para ver tus notificaciones</p>
            </div>
          ) : notifLoading ? (
            <div className="notif-loading">Cargando...</div>
          ) : !notifications || notifications.length === 0 ? (
            <div className="notif-empty">No tenés notificaciones</div>
          ) : (
            notifications.map(n => {
              const isMod = n.tipo === 'moderacion_contenido'
              const modType = n.mensaje?.includes('categoría') ? 'categoria'
                : n.mensaje?.includes('tema') ? 'tema'
                : 'comentario'
              const isFollowRequest = n.tipo === 'solicitud_seguimiento'
              const clickable = !!n.url
              return (
                <div
                  key={n.id}
                  className={`notif-item notif-item--${n.tipo}${clickable ? ' notif-item--clickable' : ''}`}
                  onClick={clickable ? () => handleItemClick(n) : undefined}
                  role={clickable ? 'button' : undefined}
                  tabIndex={clickable ? 0 : undefined}
                >
                  {n.actor_nickname ? (
                    <div className="notif-actor">
                      <UserAvatar url_imagen={n.actor_url_imagen} nickname={n.actor_nickname} size={36} />
                      <span className={`notif-type-dot notif-type-dot--${n.tipo}`}>
                        <NotifTypeIcon tipo={n.tipo} />
                      </span>
                    </div>
                  ) : (
                    <div className="notif-icon">
                      <NotifTypeIcon tipo={n.tipo} />
                    </div>
                  )}
                  <div className="notif-content">
                    <p className="notif-message">{n.mensaje}</p>
                    {n.contenido_preview && (
                      <p className="notif-preview">{n.contenido_preview}</p>
                    )}
                    {isMod && (
                      <a
                        href={`/central/moderation/moderation-info.html?tipo=${modType}`}
                        className="notif-link"
                        target="_blank"
                        rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                      >
                        Leer más
                      </a>
                    )}
                    {isFollowRequest && (
                      <div className="notif-request-actions">
                        <button
                          type="button"
                          className="notif-req-btn notif-req-accept"
                          onClick={e => { e.stopPropagation(); handleFollowRequest(n, 'accept') }}
                        >
                          Aceptar
                        </button>
                        <button
                          type="button"
                          className="notif-req-btn notif-req-reject"
                          onClick={e => { e.stopPropagation(); handleFollowRequest(n, 'reject') }}
                        >
                          Rechazar
                        </button>
                      </div>
                    )}
                    <span className="notif-time">{notifTimeAgo(n.fecha_creacion)}</span>
                  </div>
                  {/* Las solicitudes de seguimiento no se pueden borrar a mano:
                      solo se quitan al Aceptar/Rechazar, para no perderlas por
                      un borrado accidental. */}
                  {!isFollowRequest && (
                    <button
                      className="notif-delete"
                      type="button"
                      title="Eliminar notificación"
                      onClick={e => { e.stopPropagation(); handleDelete(n.id) }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
