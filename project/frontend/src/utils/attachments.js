import { buildPollPayload } from './poll'

export const MAX_ARCHIVOS = 3
export const MAX_TAMANO = 10 * 1024 * 1024 // 10 MB

// La validación real es por contenido, en el backend.
const EXT_IMAGEN = ['jpg', 'jpeg', 'png', 'gif', 'webp']
const EXT_DOC = ['pdf', 'doc', 'docx', 'zip', 'rar', 'xlsx', 'xls', 'pptx']
const EXT_PERMITIDAS = [...EXT_IMAGEN, ...EXT_DOC]

export const ACCEPT_ATTR = 'image/*,.pdf,.doc,.docx,.zip,.rar,.xlsx,.xls,.pptx'

function extOf(name) {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

export function esImagen(file) {
  if (file.type && file.type.startsWith('image/')) return true
  return EXT_IMAGEN.includes(extOf(file.name))
}

export function validarArchivo(file) {
  const ext = extOf(file.name)
  const tipoOk = (file.type && file.type.startsWith('image/')) || EXT_PERMITIDAS.includes(ext)
  if (!tipoOk) {
    return { ok: false, error: `Tipo de archivo no permitido: ${file.name}` }
  }
  if (file.size > MAX_TAMANO) {
    return { ok: false, error: `${file.name} supera el límite de 10 MB` }
  }
  return { ok: true }
}

// `poll` es el estado del editor; se convierte al payload del backend.
export function buildReplyFormData(fields, files = [], poll = null) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null && v !== '') fd.append(k, v)
  }
  for (const f of files) fd.append('archivos', f)
  if (poll) fd.append('encuesta', JSON.stringify(buildPollPayload(poll)))
  return fd
}

// Agrega fl_attachment para que el navegador descargue el archivo en vez de renderizarlo.
export function documentDownloadUrl(url) {
  if (!url) return url
  // Una URL firmada no se reescribe: rompería la firma.
  if (url.includes('fl_attachment') || url.includes('/s--')) return url
  return url.includes('/raw/upload/')
    ? url.replace('/raw/upload/', '/raw/upload/fl_attachment/')
    : url
}
