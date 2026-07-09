import { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { apiGet } from '../../api/client'
import { UserAvatar } from './UserAvatar'
import './MentionSuggestions.css'

export function useMentions(textareaRef) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  function handleChange(text, selectionStart) {
    const before = text.slice(0, selectionStart)
    const match = before.match(/@(\w[\w.-]{0,29})$/)
    if (match) {
      setQuery(match[1])
      setActive(true)
      if (textareaRef.current) {
        const ta = textareaRef.current
        setPosition({ top: ta.offsetHeight + 4, left: 0 })
      }
    } else {
      setActive(false)
      setQuery('')
    }
  }

  function insertMention(text, selectionStart, nickname) {
    const before = text.slice(0, selectionStart)
    const after = text.slice(selectionStart)
    const atIndex = before.lastIndexOf('@')
    const newText = before.slice(0, atIndex) + '@' + nickname + ' ' + after
    const newCursor = atIndex + nickname.length + 2
    setActive(false)
    setQuery('')
    return { newText, newCursor }
  }

  return { query, active, position, handleChange, insertMention, setActive }
}

export const MentionSuggestions = forwardRef(function MentionSuggestions({ query, position, onSelect, onClose }, ref) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const debounceRef = useRef(null)

  useEffect(() => {
    setSelectedIdx(0)
    if (!query || query.length < 2) {
      setResults([])
      return
    }
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await apiGet(`/users/search?q=${encodeURIComponent(query)}`)
        setResults(res.data || [])
      } catch {
        setResults([])
      }
      setLoading(false)
    }, 200)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  useImperativeHandle(ref, () => function handleKeyDown(e) {
    if (results.length === 0) return false
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx(i => Math.min(i + 1, results.length - 1))
      return true
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx(i => Math.max(i - 1, 0))
      return true
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      onSelect(results[selectedIdx].nickname)
      return true
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return true
    }
    return false
  }, [results, selectedIdx, onSelect, onClose])

  if (!query || query.length < 2 || (results.length === 0 && !loading)) return null

  return (
    <div className="mention-suggestions" style={{ top: position.top, left: position.left }}>
      {loading ? (
        <div className="mention-item mention-item--loading">Buscando...</div>
      ) : (
        results.map((u, i) => (
          <div
            key={u.id}
            className={`mention-item${i === selectedIdx ? ' mention-item--active' : ''}`}
            onMouseEnter={() => setSelectedIdx(i)}
            onMouseDown={e => { e.preventDefault(); onSelect(u.nickname) }}
          >
            <UserAvatar url_imagen={u.url_imagen} nickname={u.nickname} size={28} />
            <div className="mention-item-info">
              <span className="mention-item-nick">@{u.nickname}</span>
              {u.nombre && <span className="mention-item-name">{u.nombre}</span>}
            </div>
          </div>
        ))
      )}
    </div>
  )
})
