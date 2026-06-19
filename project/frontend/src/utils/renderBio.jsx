const URL_REGEX = /(https?:\/\/[^\s]+)/g

export function BioText({ text }) {
  if (!text) return null

  const parts = text.split(URL_REGEX)

  return parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0
      return (
        <a
          key={i}
          href={`/redirect?to=${encodeURIComponent(part)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="bio-link"
        >
          {part}
        </a>
      )
    }
    URL_REGEX.lastIndex = 0
    return <span key={i}>{part}</span>
  })
}
