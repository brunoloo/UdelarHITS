// Returns an array of React elements: plain text segments, <br> for newlines,
// <a className="bio-link"> for detected URLs, and <a className="mention-link">
// for @mentions.
// React escapes all string content automatically — no manual escapeHtml needed.
import { Link } from 'react-router-dom'

const URL_REGEX = /(https?:\/\/[^\s]+)/g
const MENTION_REGEX = /@(\w[\w.-]{0,29})/g
const COMBINED_REGEX = /(https?:\/\/[^\s]+|@\w[\w.-]{0,29})/g

export function renderBioWithLinks(text) {
  if (!text) return null

  const parts = text.split(COMBINED_REGEX)
  const elements = []
  let key = 0

  for (const part of parts) {
    if (!part) continue
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0
      elements.push(
        <a
          key={key++}
          href={`/redirect?to=${encodeURIComponent(part)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bio-link"
        >
          {part}
        </a>
      )
    } else if (part.startsWith('@') && MENTION_REGEX.test(part)) {
      MENTION_REGEX.lastIndex = 0
      const nickname = part.slice(1)
      elements.push(
        <Link
          key={key++}
          to={`/user/${encodeURIComponent(nickname)}`}
          className="mention-link"
          onClick={e => e.stopPropagation()}
        >
          {part}
        </Link>
      )
    } else {
      const lines = part.split('\n')
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]) elements.push(lines[i])
        if (i < lines.length - 1) elements.push(<br key={key++} />)
      }
    }
  }

  return elements
}

export function BioText({ text }) {
  return renderBioWithLinks(text)
}
