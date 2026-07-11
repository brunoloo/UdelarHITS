export function isInternalUrl(raw) {
  if (!raw || typeof raw !== 'string') return false

  if (raw.startsWith('/') && !raw.startsWith('//')) return true

  let url
  try {
    if (!/^https?:\/\//i.test(raw) && !raw.startsWith('//')) {
      url = new URL(`https://${raw}`)
    } else {
      url = new URL(raw)
    }
  } catch {
    return false
  }

  const current = window.location.hostname
  return url.hostname === current || url.hostname === `www.${current}` ||
    `www.${url.hostname}` === current
}

export function toRelativePath(raw) {
  if (raw.startsWith('/') && !raw.startsWith('//')) return raw

  try {
    const url = /^https?:\/\//i.test(raw)
      ? new URL(raw)
      : new URL(`https://${raw}`)
    return url.pathname + url.search + url.hash
  } catch {
    return '/'
  }
}
