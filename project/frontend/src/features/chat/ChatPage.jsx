import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useSocket } from '../../context/SocketContext'
import { apiGet, apiPost, apiDelete } from '../../api/client'
import { UserAvatar } from '../../components/shared/UserAvatar'
import './chat.css'

function timeLabel(dateStr) {
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now - d
  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' })
  }
  if (diff < 604800000) {
    return d.toLocaleDateString('es-UY', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('es-UY', { day: 'numeric', month: 'short' })
}

export function ChatPage() {
  const { nickname } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const socket = useSocket()

  const [conversations, setConversations] = useState([])
  const [activeConv, setActiveConv] = useState(null)
  const [otherUser, setOtherUser] = useState(null)
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [convError, setConvError] = useState(null)

  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const searchTimeout = useRef(null)

  const fetchConversations = useCallback(async () => {
    try {
      const res = await apiGet('/chat/conversations')
      setConversations(res.data)
    } catch {}
  }, [])

  useEffect(() => { fetchConversations() }, [fetchConversations])

  useEffect(() => {
    if (!nickname) {
      setActiveConv(null)
      setOtherUser(null)
      setMessages([])
      setConvError(null)
      return
    }
    let cancelled = false
    setConvError(null);
    (async () => {
      try {
        const res = await apiGet(`/chat/conversations/${encodeURIComponent(nickname)}`)
        if (cancelled) return
        setActiveConv(res.data.conversacion_id)
        setOtherUser(res.data.usuario)
        setMessages([])
        setHasMore(true)
      } catch (err) {
        if (cancelled) return
        console.error('Error al cargar conversación:', err)
        const is404 = err.message?.includes('no encontrado')
        const isSelf = err.message?.includes('vos mismo')
        if (is404 || isSelf) {
          navigate('/chat', { replace: true })
        } else {
          setConvError(err.message || 'No se pudo cargar la conversación')
        }
      }
    })()
    return () => { cancelled = true }
  }, [nickname, navigate])

  useEffect(() => {
    if (!activeConv) return
    let cancelled = false;
    (async () => {
      setLoadingMsgs(true)
      try {
        const res = await apiGet(`/chat/conversations/${activeConv}/messages`)
        if (!cancelled) {
          setMessages(res.data)
          setHasMore(res.data.length >= 50)
        }
      } catch {}
      if (!cancelled) setLoadingMsgs(false)
    })()
    return () => { cancelled = true }
  }, [activeConv])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!socket) return
    function handleNew(msg) {
      if (msg.conversacion_id === activeConv) {
        setMessages(prev => [...prev, msg])
      } else {
        setConversations(prev => prev.map(c =>
          c.id === msg.conversacion_id
            ? { ...c, no_leidos: (c.no_leidos || 0) + 1, ultimo_mensaje: msg.cuerpo, ultimo_mensaje_at: msg.fecha_creacion }
            : c
        ))
      }
      fetchConversations()
    }
    socket.on('mensaje:nuevo', handleNew)
    return () => {
      socket.off('mensaje:nuevo', handleNew)
    }
  }, [socket, activeConv, fetchConversations])

  async function loadMore() {
    if (!hasMore || loadingMsgs || messages.length === 0) return
    const oldest = messages[0]
    setLoadingMsgs(true)
    try {
      const res = await apiGet(`/chat/conversations/${activeConv}/messages?before=${oldest.id}`)
      setMessages(prev => [...res.data, ...prev])
      setHasMore(res.data.length >= 50)
    } catch {}
    setLoadingMsgs(false)
  }

  async function handleSend() {
    if (!text.trim() || sending || !activeConv) return
    setSending(true)
    try {
      const res = await apiPost(`/chat/conversations/${activeConv}/messages`, { cuerpo: text.trim() })
      setMessages(prev => [...prev, res.data])
      setText('')
      fetchConversations()
    } catch (err) {
      console.error('Error al enviar mensaje:', err)
    }
    setSending(false)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function handleDeleteConversation() {
    if (!activeConv) return
    try {
      await apiDelete(`/chat/conversations/${activeConv}`)
      setActiveConv(null)
      setOtherUser(null)
      setMessages([])
      navigate('/chat', { replace: true })
      fetchConversations()
    } catch (err) {
      console.error('Error al borrar conversación:', err)
    }
  }

  useEffect(() => {
    clearTimeout(searchTimeout.current)
    if (search.length < 2) { setSearchResults([]); return }
    setSearching(true)
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await apiGet(`/users/search?q=${encodeURIComponent(search)}`)
        setSearchResults(res.data || [])
      } catch { setSearchResults([]) }
      setSearching(false)
    }, 250)
  }, [search])

  return (
    <div className="chat-layout">
      <div className="chat-sidebar">
        <div className="chat-sidebar-header">
          <h3>Mensajes</h3>
        </div>
        <div className="chat-search">
          <input
            type="text"
            placeholder="Buscar usuario..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search.length >= 2 && (
            <div className="chat-search-results">
              {searching ? (
                <div className="chat-search-item chat-search-item--loading">Buscando...</div>
              ) : searchResults.length === 0 ? (
                <div className="chat-search-item chat-search-item--loading">Sin resultados</div>
              ) : (
                searchResults.filter(u => u.id !== user?.id).map(u => (
                  <div
                    key={u.id}
                    className="chat-search-item"
                    onClick={() => { setSearch(''); navigate(`/chat/${encodeURIComponent(u.nickname)}`) }}
                  >
                    <UserAvatar url_imagen={u.url_imagen} nickname={u.nickname} size={32} />
                    <span>@{u.nickname}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
        <div className="chat-conv-list">
          {conversations.map(c => (
            <div
              key={c.id}
              className={`chat-conv-item${c.otro_nickname === nickname ? ' active' : ''}`}
              onClick={() => navigate(`/chat/${encodeURIComponent(c.otro_nickname)}`)}
            >
              <UserAvatar url_imagen={c.otro_url_imagen} nickname={c.otro_nickname} size={40} />
              <div className="chat-conv-info">
                <div className="chat-conv-top">
                  <span className="chat-conv-nick">@{c.otro_nickname}</span>
                  {c.ultimo_mensaje_at && (
                    <span className="chat-conv-time">{timeLabel(c.ultimo_mensaje_at)}</span>
                  )}
                </div>
                <div className="chat-conv-bottom">
                  <span className="chat-conv-preview">
                    {c.ultimo_mensaje ? (c.ultimo_mensaje.length > 50 ? c.ultimo_mensaje.slice(0, 50) + '...' : c.ultimo_mensaje) : 'Sin mensajes'}
                  </span>
                  {c.no_leidos > 0 && (
                    <span className="chat-conv-badge">{c.no_leidos > 9 ? '+9' : c.no_leidos}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
          {conversations.length === 0 && (
            <div className="chat-empty-sidebar">No tenés conversaciones</div>
          )}
        </div>
      </div>

      <div className="chat-main">
        {!nickname ? (
          <div className="chat-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <p>Seleccioná una conversación</p>
          </div>
        ) : convError ? (
          <div className="chat-empty">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p>Error: {convError}</p>
          </div>
        ) : (
          <>
            <div className="chat-header">
              <div className="chat-header-row">
                <Link to={`/user/${encodeURIComponent(otherUser?.nickname || nickname)}`} className="chat-header-user">
                  <UserAvatar url_imagen={otherUser?.url_imagen} nickname={otherUser?.nickname || nickname} size={36} />
                  <span className="chat-header-nick">@{otherUser?.nickname || nickname}</span>
                </Link>
                <button
                  className="chat-delete-btn"
                  type="button"
                  onClick={handleDeleteConversation}
                  title="Borrar conversación"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/>
                    <path d="M14 11v6"/>
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                  </svg>
                </button>
              </div>
            </div>
            <div className="chat-messages" ref={messagesContainerRef}>
              {hasMore && messages.length > 0 && (
                <button className="chat-load-more" type="button" onClick={loadMore} disabled={loadingMsgs}>
                  {loadingMsgs ? 'Cargando...' : 'Cargar anteriores'}
                </button>
              )}
              {loadingMsgs && messages.length === 0 && (
                <div className="chat-loading">Cargando mensajes...</div>
              )}
              {messages.map(m => {
                const isOwn = m.autor_id === user?.id
                return (
                  <div key={m.id} className={`chat-bubble-row${isOwn ? ' own' : ''}`}>
                    <div className={`chat-bubble${isOwn ? ' chat-bubble--own' : ''}`}>
                      <p>{m.cuerpo}</p>
                      <span className="chat-bubble-time">
                        {timeLabel(m.fecha_creacion)}
                      </span>
                    </div>
                  </div>
                )
              })}
              <div ref={messagesEndRef} />
            </div>
            <div className="chat-input-bar">
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribí un mensaje..."
                maxLength={2000}
                rows={1}
              />
              <button
                className="chat-send-btn"
                type="button"
                onClick={handleSend}
                disabled={!text.trim() || sending || !activeConv}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="22" y1="2" x2="11" y2="13"/>
                  <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
