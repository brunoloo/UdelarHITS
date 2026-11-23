import { describe, it, expect } from 'vitest'
import { validarArchivo, excedeTotal, MAX_TAMANO, MAX_TOTAL } from '../attachments'

const archivo = (name, size, type = '') => ({ name, size, type })

describe('validarArchivo', () => {
  it('acepta imágenes y documentos permitidos', () => {
    expect(validarArchivo(archivo('foto.png', 100, 'image/png')).ok).toBe(true)
    expect(validarArchivo(archivo('apuntes.pdf', 100)).ok).toBe(true)
    expect(validarArchivo(archivo('notas.DOCX', 100)).ok).toBe(true)
  })

  it('rechaza tipos no permitidos', () => {
    const r = validarArchivo(archivo('virus.exe', 100))
    expect(r.ok).toBe(false)
    expect(r.error).toBe('Tipo de archivo no permitido: virus.exe')
  })

  it('rechaza archivos de más de 10 MB', () => {
    expect(validarArchivo(archivo('justo.pdf', MAX_TAMANO)).ok).toBe(true)
    const r = validarArchivo(archivo('grande.pdf', MAX_TAMANO + 1))
    expect(r.ok).toBe(false)
    expect(r.error).toBe('grande.pdf supera el límite de 10 MB')
  })
})

describe('excedeTotal', () => {
  const MB = 1024 * 1024

  it('permite llegar justo al tope', () => {
    const files = Array.from({ length: 4 }, (_, i) => archivo(`f${i}.pdf`, 10 * MB))
    expect(excedeTotal(files, archivo('ultimo.pdf', MAX_TOTAL - 40 * MB))).toBe(false)
  })

  it('detecta cuando el nuevo archivo pasa el tope', () => {
    const files = Array.from({ length: 5 }, (_, i) => archivo(`f${i}.pdf`, 10 * MB))
    expect(excedeTotal(files, archivo('extra.pdf', 1))).toBe(true)
  })

  it('con la lista vacía solo cuenta el nuevo', () => {
    expect(excedeTotal([], archivo('a.pdf', MB))).toBe(false)
  })
})
