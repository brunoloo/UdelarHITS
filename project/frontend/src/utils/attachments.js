import { buildPollPayload } from './poll'

// Configuración compartida para adjuntos en comentarios.
export const MAX_ARCHIVOS = 3
export const MAX_TAMANO = 10 * 1024 * 1024 // 10 MB

// Extensiones permitidas (la validación real por magic-numbers ocurre en el back).
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

// Devuelve { ok: true } o { ok: false, error } para un archivo.
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

// Construye el FormData para POST /replies/create. `fields` solo incluye las
// claves con valor; `files` van bajo la clave 'archivos'.
// `poll` es el estado del editor ({ opciones, dias, horas, minutos }); se
// convierte al payload del backend ({ opciones, duracion_segundos }).
export function buildReplyFormData(fields, files = [], poll = null) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null && v !== '') fd.append(k, v)
  }
  for (const f of files) fd.append('archivos', f)
  if (poll) fd.append('encuesta', JSON.stringify(buildPollPayload(poll)))
  return fd
}

// URL de descarga para documentos: agrega fl_attachment para que Cloudinary
// devuelva Content-Disposition: attachment. Así el navegador descarga el archivo
// en vez de intentar renderizarlo inline (que con los PDF fallaba con
// "error al cargar el documento PDF").
export function documentDownloadUrl(url) {
  if (!url) return url
  // Si ya viene firmada (s--…) o con fl_attachment desde el backend, no la tocamos
  // (reescribirla rompería la firma de Cloudinary).
  if (url.includes('fl_attachment') || url.includes('/s--')) return url
  return url.includes('/raw/upload/')
    ? url.replace('/raw/upload/', '/raw/upload/fl_attachment/')
    : url
}
