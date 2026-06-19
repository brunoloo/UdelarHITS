import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../context/AuthContext'
import { apiGet, apiPatch, apiDelete } from '../../api/client'
import './LeftNav.css'

function notifTimeAgo(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'hace un momento'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`
  if (diff < 604800) return `hace ${Math.floor(diff / 86400)} d`
  return new Date(dateStr).toLocaleDateString('es-UY')
}

export function LeftNav() {
  const { user } = useAuth()
  const { pathname } = useLocation()
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

        <button className="nav-item" id="nav-chat">
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
                <path d="M9 3h6"/>
                <path d="M10 3v5l-5.5 9.5A2 2 0 0 0 6 20h12a2 2 0 0 0 1.5-3.5L14 8V3"/>
                <path d="M8 16h8"/>
              </svg>
              Desarrollo
            </Link>
          </>
        )}

        <a href="/central/info/about.html" target="_blank" rel="noreferrer" className="nav-item" id="nav-about">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Quienes somos
        </a>

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
              return (
                <div key={n.id} className="notif-item">
                  <div className="notif-icon">
                    {isMod ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                        <line x1="4" y1="22" x2="4" y2="15"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/>
                        <path d="M10 21a2 2 0 0 0 4 0"/>
                      </svg>
                    )}
                  </div>
                  <div className="notif-content">
                    <p className="notif-message">{n.mensaje}</p>
                    {isMod && (
                      <a
                        href={`/central/moderation/moderation-info.html?tipo=${modType}`}
                        className="notif-link"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Leer más
                      </a>
                    )}
                    <span className="notif-time">{notifTimeAgo(n.fecha_creacion)}</span>
                  </div>
                  <button
                    className="notif-delete"
                    type="button"
                    title="Eliminar notificación"
                    onClick={() => handleDelete(n.id)}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
