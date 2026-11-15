import { useRef, useState, useEffect, useLayoutEffect } from 'react'
import { facultadBySigla } from '../../config/facultades'
import './FacultySelect.css'

// Reemplaza al <select> nativo, cuyo menú lo dibuja el sistema operativo e ignora el tema oscuro.
export function FacultySelect({ value, onChange, facultades = [], id }) {
  const [open, setOpen] = useState(false)
  // Resaltado por teclado, aparte de `value`: las flechas no eligen hasta confirmar con Enter.
  const [highlight, setHighlight] = useState(0)
  // Si el menú no entra debajo del trigger, abre hacia arriba.
  const [openUpward, setOpenUpward] = useState(false)

  const wrapRef = useRef(null)
  const listRef = useRef(null)
  const triggerRef = useRef(null)

  // "Sin especificar" es una opción más, para que el teclado la trate igual.
  const options = [
    { value: '', label: 'Sin especificar', color: null },
    ...facultades.map(f => ({
      value: f.nombre,
      label: `Facultad de ${f.nombre_display}`,
      color: facultadBySigla(f.nombre)?.color ?? 'var(--accent)',
    })),
  ]

  const selectedIndex = Math.max(0, options.findIndex(o => o.value === (value || '')))
  const selected = options[selectedIndex]

  useEffect(() => {
    if (!open) return

    function handleClickOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }

    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [open])

  // Se mide antes del paint para que el cambio de dirección no parpadee.
  useLayoutEffect(() => {
    if (!open) return
    const rect = wrapRef.current.getBoundingClientRect()
    const menuHeight = listRef.current?.offsetHeight || 240
    const spaceBelow = window.innerHeight - rect.bottom
    setOpenUpward(spaceBelow < menuHeight && rect.top > spaceBelow)
  }, [open])

  // La opción resaltada debe quedar visible al navegar con el teclado.
  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector('[data-highlighted="true"]')
    // Llamada opcional: jsdom no implementa scrollIntoView.
    el?.scrollIntoView?.({ block: 'nearest' })
  }, [open, highlight])

  function openMenu(startIndex = selectedIndex) {
    setHighlight(startIndex)
    setOpen(true)
  }

  function choose(index) {
    onChange(options[index].value)
    setOpen(false)
    triggerRef.current?.focus()
  }

  function handleKeyDown(e) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openMenu()
      }
      return
    }

    switch (e.key) {
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
        break
      case 'ArrowDown':
        e.preventDefault()
        setHighlight(i => Math.min(i + 1, options.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlight(i => Math.max(i - 1, 0))
        break
      case 'Home':
        e.preventDefault()
        setHighlight(0)
        break
      case 'End':
        e.preventDefault()
        setHighlight(options.length - 1)
        break
      case 'Enter':
      case ' ':
        e.preventDefault()
        choose(highlight)
        break
      case 'Tab':
        setOpen(false)
        break
      default:
        break
    }
  }

  const listId = id ? `${id}-listbox` : undefined

  return (
    <div className="faculty-select" ref={wrapRef}>
      <button
        type="button"
        id={id}
        ref={triggerRef}
        className={`faculty-select-trigger${open ? ' is-open' : ''}`}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
      >
        <span className="faculty-select-value">
          {selected.color
            ? <span className="faculty-select-dot" style={{ '--fac-color': selected.color }} aria-hidden="true" />
            : null}
          <span className={selected.value ? '' : 'faculty-select-placeholder'}>
            {selected.label}
          </span>
        </span>
        <svg className="faculty-select-chevron" width="16" height="16" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <ul
          className={`faculty-select-menu${openUpward ? ' faculty-select-menu--up' : ''}`}
          id={listId}
          ref={listRef}
          role="listbox"
          aria-activedescendant={id ? `${id}-opt-${highlight}` : undefined}
        >
          {options.map((opt, index) => (
            <li key={opt.value || '__none'}>
              <button
                type="button"
                id={id ? `${id}-opt-${index}` : undefined}
                role="option"
                aria-selected={index === selectedIndex}
                data-highlighted={index === highlight}
                className={`faculty-select-option${index === selectedIndex ? ' is-selected' : ''}`}
                onClick={() => choose(index)}
                onMouseEnter={() => setHighlight(index)}
              >
                {opt.color
                  ? <span className="faculty-select-dot" style={{ '--fac-color': opt.color }} aria-hidden="true" />
                  : <span className="faculty-select-dot faculty-select-dot--none" aria-hidden="true" />}
                <span className={opt.value ? '' : 'faculty-select-placeholder'}>{opt.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
