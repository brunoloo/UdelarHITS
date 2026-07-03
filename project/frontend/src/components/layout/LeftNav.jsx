import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../hooks/useToast'
import { UserAvatar } from '../shared/UserAvatar'
import { SavedPanel } from './SavedPanel'
import { apiGet, apiPost, apiPatch, apiDelete } from '../../api/client'
import { useSocket } from '../../context/SocketContext'
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
  if (tipo === 'mencion_comentario') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/>
      </svg>
    )
  }
  if (tipo === 'respuesta_comentario' || tipo === 'comentario_en_categoria' ||
      tipo === 'comentario_en_tema' || tipo === 'comentario_en_tema_categoria' ||
      tipo === 'comentario_categoria_seguida') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    )
  }
  if (tipo === 'tema_en_categoria' || tipo === 'tema_categoria_seguida') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="8" y1="13" x2="16" y2="13"/>
        <line x1="8" y1="17" x2="13" y2="17"/>
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
  const socket = useSocket()
  const isAdmin = user?.rol === 'admin'

  const [chatUnread, setChatUnread] = useState(0)

  useEffect(() => {
    if (!user) return
    apiGet('/chat/conversations').then(res => {
      const total = (res.data || []).reduce((sum, c) => sum + (c.no_leidos || 0), 0)
      setChatUnread(total)
    }).catch(() => {})
  }, [user])

  useEffect(() => {
    if (pathname.startsWith('/chat')) setChatUnread(0)
  }, [pathname])

  useEffect(() => {
    if (!socket) return
    function handleNewMsg() {
      if (!pathname.startsWith('/chat')) {
        setChatUnread(prev => prev + 1)
      }
    }
    socket.on('mensaje:nuevo', handleNewMsg)
    return () => { socket.off('mensaje:nuevo', handleNewMsg) }
  }, [socket, pathname])

  useEffect(() => {
    if (!socket) return
    function handleNewNotif(notif) {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
      setNotifications(prev => prev ? [notif, ...prev] : prev)
      if (notif.tipo === 'solicitud_aceptada') {
        queryClient.invalidateQueries({ queryKey: ['user'] })
      }
    }
    function handleDeletedNotif({ ids }) {
      queryClient.invalidateQueries({ queryKey: ['notifications', 'unread-count'] })
      setNotifications(prev => prev ? prev.filter(n => !ids.includes(n.id)) : prev)
    }
    function handleFollowUpdate() {
      queryClient.invalidateQueries({ queryKey: ['user'] })
    }
    socket.on('notificacion:nueva', handleNewNotif)
    socket.on('notificacion:eliminada', handleDeletedNotif)
    socket.on('seguimiento:actualizado', handleFollowUpdate)
    return () => {
      socket.off('notificacion:nueva', handleNewNotif)
      socket.off('notificacion:eliminada', handleDeletedNotif)
      socket.off('seguimiento:actualizado', handleFollowUpdate)
    }
  }, [socket, queryClient])

  // Solo un panel abierto a la vez: 'notif' | 'saved' | null.
  const [activePanel, setActivePanel] = useState(null)
  const panelOpen = activePanel === 'notif'
  const savedOpen = activePanel === 'saved'
  const [notifications, setNotifications] = useState(null)
  const [notifLoading, setNotifLoading] = useState(false)
  const panelRef = useRef(null)
  const notifBtnRef = useRef(null)
  const savedPanelRef = useRef(null)
  const savedBtnRef = useRef(null)

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => apiGet('/notifications/unread-count').then(r => r.data?.total ?? 0),
    enabled: !!user,
    refetchInterval: 60000,
  })

  useEffect(() => {
    if (!activePanel) return
    function handleClick(e) {
      // Los overlays (modales y menús de 3 puntos) son parte de la interacción
      // aunque se rendericen fuera del panel (el modal hace portal a body). No
      // deben cerrar el panel.
      if (e.target.closest?.('.modal-backdrop, .comment-dropdown, .comment-menu-wrap, .bottom-nav')) return
      const inNotif = panelRef.current?.contains(e.target) || notifBtnRef.current?.contains(e.target)
      const inSaved = savedPanelRef.current?.contains(e.target) || savedBtnRef.current?.contains(e.target)
      if (!inNotif && !inSaved) setActivePanel(null)
    }
    function handleKey(e) {
      if (e.key === 'Escape') setActivePanel(null)
    }
    document.addEventListener('click', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('click', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [activePanel])

  async function openPanel() {
    setActivePanel('notif')
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

  useEffect(() => {
    function handleToggle() {
      if (panelOpen) {
        setActivePanel(null)
      } else {
        openPanel()
      }
    }
    window.addEventListener('toggle-notif-panel', handleToggle)
    return () => window.removeEventListener('toggle-notif-panel', handleToggle)
  })

  function handleNotifClick(e) {
    e.preventDefault()
    e.stopPropagation()
    if (panelOpen) {
      setActivePanel(null)
    } else {
      openPanel()
    }
  }

  function handleSavedClick(e) {
    e.preventDefault()
    e.stopPropagation()
    setActivePanel(prev => (prev === 'saved' ? null : 'saved'))
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
    setActivePanel(null)
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
            <span className="notif-badge">{unreadCount > 9 ? '+9' : unreadCount}</span>
          )}
        </button>

        <Link to="/chat" className={navClass('/chat')} id="nav-chat">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Chat
          {chatUnread > 0 && (
            <span className="notif-badge">{chatUnread > 9 ? '+9' : chatUnread}</span>
          )}
        </Link>

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

        <button
          ref={savedBtnRef}
          className={`nav-item${savedOpen ? ' active' : ''}`}
          id="nav-guardados"
          onClick={handleSavedClick}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
          Guardados
        </button>

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
            onClick={() => setActivePanel(null)}
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
              // Cuenta inactiva → se anonimiza el nombre del actor (avatar y
              // mensaje, que viene con el nickname al inicio). 'ban' queda público.
              const actorInactive = n.actor_estado === 'inactivo'
              const actorName = actorInactive ? 'Usuario inactivo' : n.actor_nickname
              let message = n.mensaje
              if (actorInactive && n.actor_nickname && message?.startsWith(n.actor_nickname)) {
                message = 'Usuario inactivo' + message.slice(n.actor_nickname.length)
              }
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
                      <UserAvatar url_imagen={actorInactive ? null : n.actor_url_imagen} nickname={actorName} size={36} inactive={actorInactive} />
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
                    <p className="notif-message">{message}</p>
                    {(n.contenido_preview || n.tiene_imagen || n.tiene_encuesta) && (
                      <p className="notif-preview">
                        {n.contenido_preview}
                        {n.tiene_imagen && (
                          <span className="notif-preview-photo">
                            {n.contenido_preview ? ' ' : ''}[foto]
                          </span>
                        )}
                        {n.tiene_encuesta && (
                          <span className="notif-preview-photo">
                            {(n.contenido_preview || n.tiene_imagen) ? ' ' : ''}[encuesta]
                          </span>
                        )}
                      </p>
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

      <SavedPanel
        open={savedOpen}
        panelRef={savedPanelRef}
        onClose={() => setActivePanel(null)}
      />
    </>
  )
}
