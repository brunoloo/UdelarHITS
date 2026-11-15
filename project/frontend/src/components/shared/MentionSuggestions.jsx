import { useState, useEffect, useLayoutEffect, useRef, useId, useImperativeHandle, forwardRef } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { apiGet } from '../../api/client'
import { UserAvatar } from './UserAvatar'
import './MentionSuggestions.css'

const EMPTY = []

// Debounce del valor: la query se dispara con el valor ya estable.
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

// Franja del viewport donde la lista puede mostrarse: debajo del header, sobre la barra
// inferior y dentro del visual viewport (el teclado lo achica).
function visibleBand() {
  let top = 0
  let bottom = window.innerHeight
  const vv = window.visualViewport
  if (vv) {
    top = vv.offsetTop
    bottom = vv.offsetTop + vv.height
  }
  const header = document.querySelector('.site-header')
  if (header) top = Math.max(top, header.getBoundingClientRect().bottom)
  const nav = document.querySelector('.bottom-nav')
  // Oculta en desktop (display: none) mide 0 de alto y no cuenta.
  const navRect = nav?.getBoundingClientRect()
  if (navRect?.height) bottom = Math.min(bottom, navRect.top)
  return { top, bottom }
}

export const MentionSuggestions = forwardRef(function MentionSuggestions({ query, anchorRef, getAnchorRect, onSelect, onClose }, ref) {
  const debouncedQ = useDebouncedValue(query, 150)
  const { data, isLoading } = useQuery({
    queryKey: ['mentions', debouncedQ],
    queryFn: () => apiGet('/users/mentions?q=' + encodeURIComponent(debouncedQ)).then(r => r.data || []),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
  const results = data || EMPTY

  // El índice vuelve a 0 cuando cambian los resultados: se ata a la identidad del array.
  const [selected, setSelected] = useState({ forResults: null, idx: 0 })
  const selectedIdx = selected.forResults === results ? Math.min(selected.idx, results.length - 1) : 0
  const setSelectedIdx = (fn) => setSelected({ forResults: results, idx: fn(selectedIdx) })

  const listRef = useRef(null)
  const listboxId = useId()

  // La dirección se mantiene mientras entre, para que la lista no salte en medio de un scroll.
  const upwardRef = useRef(false)

  // Posición fija respecto del viewport: abre debajo de la línea del "@" o arriba si no entra.
  // Si el "@" sale de la franja visible, la lista se oculta.
  useLayoutEffect(() => {
    function place() {
      const el = listRef.current
      const anchor = anchorRef?.current
      if (!el || !anchor) return
      const rect = getAnchorRect?.() || anchor.getBoundingClientRect()
      const { top: bandTop, bottom: bandBottom } = visibleBand()
      if (rect.bottom < bandTop || rect.top > bandBottom) {
        el.style.visibility = 'hidden'
        return
      }
      el.style.visibility = ''
      el.style.maxHeight = ''
      const h = el.offsetHeight
      const w = el.offsetWidth
      const spaceBelow = bandBottom - rect.bottom - GAP
      const spaceAbove = rect.top - bandTop - GAP
      let upward = upwardRef.current
      if ((upward ? spaceAbove : spaceBelow) < h) {
        upward = upward
          ? !(spaceBelow >= h || spaceBelow > spaceAbove)
          : spaceAbove >= h || spaceAbove > spaceBelow
      }
      upwardRef.current = upward
      // Si no entra entera en ningún lado, scrollea dentro de lo disponible.
      const space = upward ? spaceAbove : spaceBelow
      if (space < h) el.style.maxHeight = `${Math.max(0, space)}px`
      if (upward) {
        el.style.top = 'auto'
        el.style.bottom = `${window.innerHeight - rect.top + GAP}px`
      } else {
        el.style.bottom = 'auto'
        el.style.top = `${rect.bottom + GAP}px`
      }
      el.style.left = `${Math.max(GUTTER, Math.min(rect.left, window.innerWidth - w - GUTTER))}px`
    }
    place()
    const vv = window.visualViewport
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    vv?.addEventListener('scroll', place)
    vv?.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
      vv?.removeEventListener('scroll', place)
      vv?.removeEventListener('resize', place)
    }
  }, [anchorRef, getAnchorRect, query, results, isLoading])

  useImperativeHandle(ref, () => function handleKeyDown(e) {
    // Oculta por scroll: las teclas (Enter incluido) vuelven al textarea.
    if (results.length === 0 || listRef.current?.style.visibility === 'hidden') return false
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
