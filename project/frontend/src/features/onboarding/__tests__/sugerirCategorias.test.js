import { describe, it, expect } from 'vitest'
import { sugerirCategorias } from '../sugerirCategorias'

const cat = (id, over = {}) => ({
  id,
  titulo: `Cat ${id}`,
  etiquetas: [],
  contador_temas: 0,
  contador_comentarios: 0,
  fecha_creacion: `2026-01-0${id}T00:00:00Z`,
  ...over,
})

describe('sugerirCategorias', () => {
  it('pone primero las de la facultad del usuario, sin importar mayúsculas', () => {
    const lista = [
      cat(1, { contador_comentarios: 50 }),
      cat(2, { etiquetas: ['fing'] }),
    ]
    const res = sugerirCategorias(lista, 'FING')
    expect(res.map(c => c.id)).toEqual([2, 1])
    expect(res[0].deMiFacultad).toBe(true)
    expect(res[1].deMiFacultad).toBe(false)
  })

  it('después ordena por contenido y, a igualdad, por la más nueva', () => {
    const lista = [
      cat(1),
      cat(2, { contador_comentarios: 3 }),
      cat(3),
      cat(4, { contador_temas: 2, contador_comentarios: 4 }),
    ]
    expect(sugerirCategorias(lista, null).map(c => c.id)).toEqual([4, 2, 3, 1])
  })

  it('sin facultad o con una desconocida no marca ninguna', () => {
    const lista = [cat(1, { etiquetas: ['FING'] })]
    expect(sugerirCategorias(lista, null)[0].deMiFacultad).toBe(false)
    expect(sugerirCategorias(lista, 'no-existe')[0].deMiFacultad).toBe(false)
  })

  it('respeta el límite y no modifica la lista original', () => {
    const lista = [cat(1), cat(2), cat(3)]
    expect(sugerirCategorias(lista, null, 2)).toHaveLength(2)
    expect(lista.map(c => c.id)).toEqual([1, 2, 3])
  })
})
