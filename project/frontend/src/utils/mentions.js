// Igual al de renderBioWithLinks.jsx: lo que se resalta al escribir es lo que después se renderiza.
export const MENTION_REGEX = /@(\w[\w.-]{0,29})/g

// "@" al inicio o tras un espacio (no en emails), seguido de hasta 30 caracteres de nickname.
export const MENTION_TRIGGER_REGEX = /(^|\s)@([\w.-]{0,30})$/

export function splitMentions(text) {
  if (!text) return []
  const segments = []
  let last = 0
  for (const m of text.matchAll(MENTION_REGEX)) {
    if (m.index > last) segments.push({ text: text.slice(last, m.index), isMention: false })
    segments.push({ text: m[0], isMention: true })
    last = m.index + m[0].length
  }
  if (last < text.length) segments.push({ text: text.slice(last), isMention: false })
  return segments
}
