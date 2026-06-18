import { useState } from 'react'
import { renderBioWithLinks } from '../../utils/renderBioWithLinks'
import './ReadMore.css'

export function ReadMore({ text, maxLength = 500 }) {
  const [expanded, setExpanded] = useState(false)

  if (!text) return null

  const needsTruncate = text.length > maxLength
  const visible = needsTruncate && !expanded ? text.slice(0, maxLength) : text

  return (
    <>
      <span>
        {renderBioWithLinks(visible)}
        {needsTruncate && !expanded ? '...' : ''}
      </span>
      {needsTruncate && (
        <button
          type="button"
          className="read-more-btn"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpanded(v => !v) }}
        >
          {expanded ? 'Leer menos' : 'Leer más'}
        </button>
      )}
    </>
  )
}
