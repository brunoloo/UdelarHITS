// Una sola regex de URL para linkificar y para detectar videos.
export const URL_REGEX = /(https?:\/\/[^\s]+)/g

// ID de video de YouTube: 11 caracteres del alfabeto base64url.
export const YOUTUBE_ID_REGEX = /^[A-Za-z0-9_-]{11}$/

const YOUTUBE_HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com']

// Devuelve el id solo para videos (watch, shorts, embed, youtu.be). El hostname se compara exacto.
export function getYouTubeVideoId(url) {
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null

  const host = parsed.hostname
  const path = parsed.pathname.replace(/\/$/, '')
  let id = null

  if (YOUTUBE_HOSTS.includes(host)) {
    if (path === '/watch') {
      id = parsed.searchParams.get('v')
    } else {
      const match = path.match(/^\/(?:shorts|embed)\/([^/]+)$/)
      if (match) id = match[1]
    }
  } else if (host === 'youtu.be') {
    const match = path.match(/^\/([^/]+)$/)
    if (match) id = match[1]
  }

  return id && YOUTUBE_ID_REGEX.test(id) ? id : null
}

// matchAll trabaja sobre una copia del regex y no altera el lastIndex de URL_REGEX.
export function extractYouTubeVideoIds(text) {
  if (!text) return []
  const ids = []
  for (const match of text.matchAll(URL_REGEX)) {
    const id = getYouTubeVideoId(match[0])
    if (id) ids.push(id)
  }
  return ids
}
