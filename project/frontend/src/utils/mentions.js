// Lógica de menciones (@nickname) compartida entre el compositor y el render.
// Solo lógica: sin componentes (react-refresh pide no mezclar).

// Igual al de renderBioWithLinks.jsx: lo que se resalta mientras se escribe es
// exactamente lo que después se renderiza como mención.
export const MENTION_REGEX = /@(\w[\w.-]{0,29})/g

// Disparador del autocompletado: "@" al inicio o tras whitespace (no en emails
// tipo "mail@foo"), seguido de 0..30 caracteres de nickname hasta el cursor.
// Con "@" solo, el grupo 2 es '' (lista de usuarios al azar).
export const MENTION_TRIGGER_REGEX = /(^|\s)@([\w.-]{0,30})$/

// Parte el texto en segmentos { text, isMention } para pintar las menciones.
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
