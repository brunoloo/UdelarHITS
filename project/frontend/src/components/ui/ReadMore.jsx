import { useState } from 'react'
import { renderBioWithLinks } from '../../utils/renderBioWithLinks'
import './ReadMore.css'

const MAX_LINES = 5

export function ReadMore({ text, maxLength = 500 }) {
  const [expanded, setExpanded] = useState(false)

  if (!text) return null

  const lines = text.split('\n')
  const tooManyLines = lines.length > MAX_LINES
  const tooLong = text.length > maxLength
  const needsTruncate = tooLong || tooManyLines

  let visible = text
  if (needsTruncate && !expanded) {
    if (tooManyLines) {
      visible = lines.slice(0, MAX_LINES).join('\n')
    } else {
      visible = text.slice(0, maxLength)
    }
  }

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
