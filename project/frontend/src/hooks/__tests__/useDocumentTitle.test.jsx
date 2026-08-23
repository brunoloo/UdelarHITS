import { describe, test, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useDocumentTitle } from '../useDocumentTitle'
import { BASE_TITLE } from '../../utils/pageTitle'

function Page({ title, ready }) {
  useDocumentTitle(title, ready)
  return null
}

afterEach(cleanup)

describe('useDocumentTitle', () => {
  test('fija el document.title con el valor dado', () => {
    render(<MemoryRouter><Page title="Cálculo I · UdelarHITS" /></MemoryRouter>)
    expect(document.title).toBe('Cálculo I · UdelarHITS')
  })

  test('un título vacío cae al título base (no arrastra el de la vista previa)', () => {
    document.title = 'ada · UdelarHITS' // simula el título de una vista anterior
    render(<MemoryRouter><Page title="" /></MemoryRouter>)
    expect(document.title).toBe(BASE_TITLE)
  })

  test('actualiza el título cuando cambia (loading → resuelto)', () => {
    const { rerender } = render(
      <MemoryRouter><Page title={BASE_TITLE} ready={false} /></MemoryRouter>,
    )
    expect(document.title).toBe(BASE_TITLE)
    rerender(<MemoryRouter><Page title="Duda · Cálculo I · UdelarHITS" ready /></MemoryRouter>)
    expect(document.title).toBe('Duda · Cálculo I · UdelarHITS')
  })
})
