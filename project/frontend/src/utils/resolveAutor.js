// Los campos del autor pueden venir con prefijo (autor_nickname) o sin él (nickname).
export function resolveAutor(autor) {
  if (!autor) return { nickname: 'Usuario desconocido', url_imagen: null, facultad: null, isInactive: true }

  const estado = autor.autor_estado || autor.estado
  const nickname = autor.autor_nickname || autor.nickname || ''
  const url_imagen = autor.autor_url_imagen || autor.url_imagen || null
  // La facultad se oculta junto con el nickname cuando el autor está inactivo.
  const facultad = autor.autor_facultad || autor.facultad || null

  if (estado === 'inactivo') {
    return { nickname: 'Usuario inactivo', url_imagen: null, facultad: null, isInactive: true }
  }

  return { nickname, url_imagen, facultad, isInactive: false }
}
