import { describe, test, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FacultySelect } from '../FacultySelect'

const facultades = [
  { id: 11, nombre: 'FING', nombre_display: 'Ingeniería' },
  { id: 7, nombre: 'FDER', nombre_display: 'Derecho' },
]

describe('FacultySelect', () => {
  test('sin valor muestra el placeholder y no despliega la lista', () => {
    render(<FacultySelect value="" onChange={() => {}} facultades={facultades} />)

    expect(screen.getByRole('button')).toHaveTextContent('Sin especificar')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  test('con valor muestra el nombre completo de la facultad', () => {
    render(<FacultySelect value="FING" onChange={() => {}} facultades={facultades} />)

    expect(screen.getByRole('button')).toHaveTextContent('Facultad de Ingeniería')
  })

  test('al abrir lista "Sin especificar" más el catálogo', () => {
    render(<FacultySelect value="" onChange={() => {}} facultades={facultades} />)

    fireEvent.click(screen.getByRole('button'))

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(3)
    expect(options[0]).toHaveTextContent('Sin especificar')
    expect(options[1]).toHaveTextContent('Facultad de Ingeniería')
  })

  test('elegir una opción devuelve la abreviatura, no el nombre completo', () => {
    const onChange = vi.fn()
    render(<FacultySelect value="" onChange={onChange} facultades={facultades} />)

    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByRole('option', { name: /Facultad de Derecho/ }))

    expect(onChange).toHaveBeenCalledWith('FDER')
  })

  test('se puede volver a "Sin especificar" para limpiar el campo', () => {
    const onChange = vi.fn()
    render(<FacultySelect value="FING" onChange={onChange} facultades={facultades} />)

    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByRole('option', { name: /Sin especificar/ }))

    expect(onChange).toHaveBeenCalledWith('')
  })

  test('se navega y elige con el teclado', () => {
    const onChange = vi.fn()
    render(<FacultySelect value="" onChange={onChange} facultades={facultades} />)

    const trigger = screen.getByRole('button')
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })  // abre, resaltando la actual
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })  // baja a FING
    fireEvent.keyDown(trigger, { key: 'Enter' })

    expect(onChange).toHaveBeenCalledWith('FING')
  })

  test('Escape cierra sin elegir nada', () => {
    const onChange = vi.fn()
    render(<FacultySelect value="" onChange={onChange} facultades={facultades} />)

    const trigger = screen.getByRole('button')
    fireEvent.click(trigger)
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    fireEvent.keyDown(trigger, { key: 'Escape' })

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})
