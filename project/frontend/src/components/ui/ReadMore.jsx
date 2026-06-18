import { useState, useEffect } from 'react'
import { renderBioWithLinks } from '../../utils/renderBioWithLinks'
import './ReadMore.css'

const INITIAL_LINES = 8
const EXPAND_LINES = 12
const EXPAND_CHARS = 750

export function ReadMore({ text, maxLength = 500 }) {
  const [currentVisible, setCurrentVisible] = useState(null)

  useEffect(() => {
    setCurrentVisible(null)
  }, [text])

  if (!text) return null

  const lines = text.split('\n')
  const needsTruncateLines = lines.length > INITIAL_LINES
  const needsTruncateChars = text.length > maxLength

  if (!needsTruncateLines && !needsTruncateChars) {
    return <span>{renderBioWithLinks(text)}</span>
  }

  const mode = needsTruncateLines ? 'lines' : 'chars'
  const initial = mode === 'lines' ? INITIAL_LINES : maxLength
  const expandSize = mode === 'lines' ? EXPAND_LINES : EXPAND_CHARS
  const total = mode === 'lines' ? lines.length : text.length

  const visible = currentVisible ?? initial
  const isFullyExpanded = visible >= total

  const displayText = isFullyExpanded
    ? text
    : mode === 'lines'
      ? lines.slice(0, visible).join('\n') + '...'
      : text.slice(0, visible) + '...'

  function handleClick(e) {
    e.preventDefault()
    e.stopPropagation()
    if (isFullyExpanded) {
      setCurrentVisible(initial)
    } else {
      setCurrentVisible(Math.min(visible + expandSize, total))
    }
  }

  return (
    <>
      <span>{renderBioWithLinks(displayText)}</span>
      <button type="button" className="read-more-btn" onClick={handleClick}>
        {isFullyExpanded ? 'Leer menos' : 'Leer más'}
      </button>
    </>
  )
}
