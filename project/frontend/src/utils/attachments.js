import { buildPollPayload } from './poll'

export const MAX_ARCHIVOS = 10
export const MAX_TAMANO = 10 * 1024 * 1024 // 10 MB
export const MAX_TOTAL = 50 * 1024 * 1024 // 50 MB por comentario

const MB = 1024 * 1024
export const MENSAJE_TOTAL = `Los archivos pueden pesar hasta ${MAX_TOTAL / MB} MB en total por comentario`

// La validación real es por contenido, en el backend.
const EXT_IMAGEN = ['jpg', 'jpeg', 'png', 'gif', 'webp']
const EXT_DOC = ['pdf', 'doc', 'docx', 'zip', 'xlsx', 'xls', 'pptx']
const EXT_PERMITIDAS = [...EXT_IMAGEN, ...EXT_DOC]

export const ACCEPT_ATTR = 'image/*,.pdf,.doc,.docx,.zip,.xlsx,.xls,.pptx'

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
    return { ok: false, error: `${file.name} supera el límite de ${MAX_TAMANO / MB} MB` }
  }
  return { ok: true }
}

// true si sumar `nuevo` a `files` pasa el tope total del comentario.
export function excedeTotal(files, nuevo) {
  const total = files.reduce((suma, f) => suma + f.size, 0)
  return total + nuevo.size > MAX_TOTAL
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

function clickEnlace(href, nombre) {
  const a = document.createElement('a')
  a.href = href
  if (nombre) a.download = nombre
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// El navegador ignora `download` en enlaces de otro dominio y usa el nombre que manda el
// proveedor ("file.pdf"), así que se baja el archivo y se guarda con el nombre original.
// fetch directo y sin cookies: es un archivo externo, no la API (client.js manda credenciales,
// que el proveedor rechaza). Si falla, se sigue el enlace de siempre.
export async function descargarConNombre(url, nombre) {
  try {
    const res = await fetch(url, { credentials: 'omit' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const objectUrl = URL.createObjectURL(await res.blob())
    clickEnlace(objectUrl, nombre)
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10000)
    return true
  } catch {
    clickEnlace(url)
    return false
  }
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
