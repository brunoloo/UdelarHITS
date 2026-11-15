import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CategoryCard } from '../CategoryCard'

const base = {
  id: 1,
  titulo: 'Cálculo 1',
  descripcion: 'Dudas del curso',
  etiquetas: [],
  contador_temas: 0,
  contador_comentarios: 0,
  ultimo_tema: null,
  ultimo_comentario: null,
  icono: null,
}

const comentario = {
  id: 9,
  cuerpo: 'Hola',
  autor_nickname: 'ana',
  autor_estado: 'activo',
  fecha_creacion: new Date().toISOString(),
  likes: 0,
  contador_respuestas: 0,
  adjuntos: [],
  encuesta: null,
}

const renderCard = (category) =>
  render(<MemoryRouter><CategoryCard category={category} /></MemoryRouter>)

describe('CategoryCard', () => {
  it('sin temas no anuncia contadores en cero', () => {
    const { container } = renderCard({ ...base, contador_comentarios: 4, ultimo_comentario: comentario })
    expect(container.querySelector('.category-stats').textContent).toBe('4 comentarios')
    expect(screen.queryByText(/Todavía/)).toBeNull()
  })

  it('con un comentario y sin etiquetas no deja un pie vacío', () => {
    const { container } = renderCard({ ...base, contador_comentarios: 1, ultimo_comentario: comentario })
    expect(container.querySelector('.category-foot-link')).toBeNull()
  })

  it('una categoría sin contenido invita a estrenarla', () => {
    const { container } = renderCard(base)
    expect(container.querySelector('.category-stats')).toBeNull()
    expect(screen.getByText(/Sé el primero en comentar/)).toBeTruthy()
  })

  it('con temas muestra el último', () => {
    renderCard({
      ...base,
      contador_temas: 2,
      ultimo_tema: { titulo: 'Parcial', autor: 'ana', fecha: new Date().toISOString() },
    })
    expect(screen.getByText('Parcial')).toBeTruthy()
    expect(screen.getByText('2 temas')).toBeTruthy()
  })
})
