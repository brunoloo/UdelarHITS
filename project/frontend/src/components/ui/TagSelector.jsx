import { useState, useMemo } from 'react'
import './TagSelector.css'

export function TagSelector({ grouped = {}, selected = [], onChange, max = 10 }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return grouped
    const q = search.trim().toLowerCase()
    const result = {}
    for (const [grupo, tags] of Object.entries(grouped)) {
      const matches = tags.filter(t =>
        t.nombre.toLowerCase().includes(q) ||
        (t.nombre_display && t.nombre_display.toLowerCase().includes(q))
      )
      if (matches.length) result[grupo] = matches
    }
    return result
  }, [grouped, search])

  function toggle(id) {
    onChange(
      selected.includes(id)
        ? selected.filter(x => x !== id)
        : selected.length < max ? [...selected, id] : selected
    )
  }

  const groups = Object.entries(filtered)

  return (
    <div className="tag-selector-grouped">
      <input
        type="text"
        className="tag-search-input"
        placeholder="Buscar etiqueta..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <div className="tag-groups-scroll">
        {groups.map(([grupo, tags]) => (
          <div key={grupo} className="tag-group">
            <div className="tag-group-label">{grupo}</div>
            <div className="tag-group-options">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  className={`tag-option${selected.includes(tag.id) ? ' selected' : ''}`}
                  onClick={() => toggle(tag.id)}
                  title={tag.nombre_display || undefined}
                >
                  {tag.nombre}
                </button>
              ))}
            </div>
          </div>
        ))}
        {groups.length === 0 && (
          <div className="tag-no-results">Sin resultados</div>
        )}
      </div>
    </div>
  )
}
