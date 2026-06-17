export function parseEtiquetas(raw) {
  if (Array.isArray(raw)) return raw.filter(Boolean)
  if (typeof raw === 'string') return raw.replace(/[{}"]/g, '').split(',').map(e => e.trim()).filter(Boolean)
  return []
}
