// Returns an array of React elements: plain text segments, <br> for newlines,
// and <a className="bio-link"> for detected URLs.
// React escapes all string content automatically — no manual escapeHtml needed.
const URL_REGEX = /(https?:\/\/[^\s]+)/g

export function renderBioWithLinks(text) {
  if (!text) return null

  // split() with a capturing group includes the matched URLs in the result array
  const parts = text.split(URL_REGEX)
  const elements = []
  let key = 0

  for (const part of parts) {
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
