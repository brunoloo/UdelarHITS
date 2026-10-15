import { useState, useEffect, useLayoutEffect, useRef, useId, useImperativeHandle, forwardRef } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { apiGet } from '../../api/client'
import { UserAvatar } from './UserAvatar'
import './MentionSuggestions.css'

const EMPTY = []

// Debounce del VALOR (no hace fetch): la query de TanStack se dispara con el
// valor ya estabilizado.
function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

const GUTTER = 16
const GAP = 4

export const MentionSuggestions = forwardRef(function MentionSuggestions({ query, anchorRef, getAnchorRect, onSelect, onClose }, ref) {
  const debouncedQ = useDebouncedValue(query, 150)
  const { data, isLoading } = useQuery({
    queryKey: ['mentions', debouncedQ],
    queryFn: () => apiGet('/users/mentions?q=' + encodeURIComponent(debouncedQ)).then(r => r.data || []),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
  const results = data || EMPTY

  // El índice seleccionado vuelve a 0 cuando cambian los resultados (se ata a la
  // identidad del array en vez de resetearlo con un efecto).
  const [selected, setSelected] = useState({ forResults: null, idx: 0 })
  const selectedIdx = selected.forResults === results ? Math.min(selected.idx, results.length - 1) : 0
  const setSelectedIdx = (fn) => setSelected({ forResults: results, idx: fn(selectedIdx) })

  const listRef = useRef(null)
  const listboxId = useId()

  // Posición fija relativa al viewport (portal en body): abre abajo de la
  // línea del "@" (o del textarea si no se puede medir) o arriba si no entra,
  // según el alto medido de la lista.
  useLayoutEffect(() => {
    function place() {
      const el = listRef.current
      const anchor = anchorRef?.current
      if (!el || !anchor) return
      const rect = getAnchorRect?.() || anchor.getBoundingClientRect()
      const h = el.offsetHeight
      const w = el.offsetWidth
      const spaceBelow = window.innerHeight - rect.bottom
      const openUpward = spaceBelow < h + GAP && rect.top > spaceBelow
      if (openUpward) {
        el.style.top = 'auto'
        el.style.bottom = `${window.innerHeight - rect.top + GAP}px`
      } else {
        el.style.bottom = 'auto'
        el.style.top = `${rect.bottom + GAP}px`
      }
      el.style.left = `${Math.max(GUTTER, Math.min(rect.left, window.innerWidth - w - GUTTER))}px`
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [anchorRef, getAnchorRect, query, results, isLoading])

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
  })

  if (results.length === 0 && !isLoading) return null

  return createPortal(
    <div className="mention-suggestions" ref={listRef} role="listbox" id={listboxId} aria-label="Sugerencias de menciones">
      {results.length === 0 ? (
        <div className="mention-item mention-item--loading">Buscando...</div>
      ) : (
        results.map((u, i) => (
          <div
            key={u.id}
            role="option"
            aria-selected={i === selectedIdx}
            className={`mention-item${i === selectedIdx ? ' mention-item--active' : ''}`}
            onMouseEnter={() => setSelectedIdx(() => i)}
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
    </div>,
    document.body,
  )
})
