import { useState, useRef, useLayoutEffect, useCallback, useImperativeHandle, forwardRef } from 'react'
import { splitMentions, MENTION_TRIGGER_REGEX } from '../../utils/mentions'
import { MentionSuggestions } from './MentionSuggestions'
import './MentionTextarea.css'

// Estado del autocompletado (vive acá y no en MentionSuggestions.jsx para que
// ese archivo exporte solo componentes — regla react-refresh).
function useMentions() {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(false)
  // Índice del "@" que se está escribiendo: la lista se ancla a esa línea.
  const [atIndex, setAtIndex] = useState(-1)

  // "@" solo abre con query '' (usuarios al azar); con letras filtra por
  // prefijo. Un espacio (o cualquier cosa que rompa el patrón) cierra.
  function handleChange(text, selectionStart) {
    const before = text.slice(0, selectionStart)
    const match = before.match(MENTION_TRIGGER_REGEX)
    if (match) {
      setQuery(match[2])
      setAtIndex(selectionStart - match[2].length - 1)
      setActive(true)
    } else {
      setActive(false)
      setQuery('')
    }
  }

  function insertMention(text, selectionStart, nickname) {
    const before = text.slice(0, selectionStart)
    const after = text.slice(selectionStart)
    // El trigger termina en el cursor ($), así que el último "@" es el suyo.
    const atIndex = before.lastIndexOf('@')
    const newText = before.slice(0, atIndex) + '@' + nickname + ' ' + after
    const newCursor = atIndex + nickname.length + 2
    setActive(false)
    setQuery('')
    return { newText, newCursor }
  }

  return { query, active, atIndex, handleChange, insertMention, setActive }
}

// Rect del carácter en `index` dentro del espejo (mismo layout que el
// textarea), usando un Range sobre sus nodos de texto.
function charRectInMirror(mirror, index) {
  const walker = document.createTreeWalker(mirror, NodeFilter.SHOW_TEXT)
  let remaining = index
  let node = walker.nextNode()
  while (node) {
    if (remaining < node.length) {
      const range = document.createRange()
      // jsdom (tests) no implementa Range#getBoundingClientRect: sin medición,
      // la lista cae al borde del textarea.
      if (typeof range.getBoundingClientRect !== 'function') return null
      range.setStart(node, remaining)
      range.setEnd(node, remaining + 1)
      const rect = range.getBoundingClientRect()
      return rect.height ? rect : null
    }
    remaining -= node.length
    node = walker.nextNode()
  }
  return null
}

// Estilos que definen cómo se compone el texto: el espejo los copia del
// textarea para que cada carácter caiga exactamente en el mismo lugar.
const MIRRORED_PROPS = [
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing',
  'textTransform', 'textIndent', 'wordSpacing', 'tabSize',
  'paddingTop', 'paddingLeft', 'paddingBottom',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'borderStyle', 'borderRadius',
]

// Textarea con autocompletado de @menciones y resaltado en vivo. El textarea
// tiene el texto transparente (solo se ve el caret) y por detrás un "espejo"
// con el mismo texto, donde los @nickname van en <span className="mention-hl">.
export const MentionTextarea = forwardRef(function MentionTextarea({
  value,
  onChange,
  className,
  rows,
  maxLength,
  placeholder,
  autoFocus,
}, ref) {
  const taRef = useRef(null)
  const mirrorRef = useRef(null)
  const suggestionsRef = useRef(null)
  const mentions = useMentions()

  useImperativeHandle(ref, () => taRef.current, [])

  // Si el padre vacía el valor (p. ej. al publicar), la lista se cierra.
  const open = mentions.active && value !== ''

  const syncMirror = useCallback(() => {
    const ta = taRef.current
    const m = mirrorRef.current
    if (!ta || !m) return
    const cs = window.getComputedStyle(ta)
    for (const p of MIRRORED_PROPS) m.style[p] = cs[p]
    m.style.boxSizing = 'border-box'
    m.style.width = `${ta.offsetWidth}px`
    m.style.height = `${ta.offsetHeight}px`
    // Si el textarea muestra scrollbar vertical, su área de texto es más
    // angosta: se suma ese ancho al padding derecho del espejo para que el
    // corte de líneas coincida.
    const borders = (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0)
    const scrollbar = Math.max(0, ta.offsetWidth - ta.clientWidth - borders)
    m.style.paddingRight = `calc(${cs.paddingRight} + ${scrollbar}px)`
    m.scrollTop = ta.scrollTop
  }, [])

  useLayoutEffect(() => {
    syncMirror()
  }, [value, syncMirror])

  useLayoutEffect(() => {
    const ta = taRef.current
    if (!ta || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => syncMirror())
    ro.observe(ta)
    return () => ro.disconnect()
  }, [syncMirror])

  function handleChange(e) {
    const val = e.target.value
    onChange(val)
    mentions.handleChange(val, e.target.selectionStart)
  }

  function handleKeyDown(e) {
    if (open && suggestionsRef.current) {
      suggestionsRef.current(e)
    }
  }

  function handleSelect(nickname) {
    const ta = taRef.current
    const { newText, newCursor } = mentions.insertMention(value, ta.selectionStart, nickname)
    onChange(newText)
    requestAnimationFrame(() => {
      ta.selectionStart = newCursor
      ta.selectionEnd = newCursor
      ta.focus()
    })
  }

  const { atIndex } = mentions
  const getAnchorRect = useCallback(() => {
    const m = mirrorRef.current
    return m && atIndex >= 0 ? charRectInMirror(m, atIndex) : null
  }, [atIndex])

  function handleScroll(e) {
    if (mirrorRef.current) mirrorRef.current.scrollTop = e.target.scrollTop
  }

  const segments = splitMentions(value)

  return (
    <div className="mention-ta">
      <div
        ref={mirrorRef}
        className={`mention-ta-mirror${className ? ' ' + className : ''}`}
        aria-hidden="true"
      >
        {segments.map((s, i) => (s.isMention
          ? <span key={i} className="mention-hl">{s.text}</span>
          : s.text))}
        {/* Un salto de línea final no ocupa alto en un div: se agrega un
            carácter invisible para que el espejo tenga las mismas líneas. */}
        {value.endsWith('\n') ? '​' : null}
      </div>
      <textarea
        ref={taRef}
        className={`mention-ta-input${className ? ' ' + className : ''}`}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        autoFocus={autoFocus}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        onBlur={() => mentions.setActive(false)}
      />
      {open && (
        <MentionSuggestions
          ref={suggestionsRef}
          query={mentions.query}
          anchorRef={taRef}
          getAnchorRect={getAnchorRect}
          onSelect={handleSelect}
          onClose={() => mentions.setActive(false)}
        />
      )}
    </div>
  )
})
