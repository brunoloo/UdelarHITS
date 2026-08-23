import { describe, test, expect } from 'vitest'
import {
  SITE_NAME, BASE_TITLE,
  categoryTitle, topicTitle, commentTitle, profileTitle,
} from '../pageTitle'

// Estos títulos deben coincidir con los que inyecta el servidor en la carga
// inicial (backend/services/seo.service.js). Si allá cambia el formato, estos
// tests fallan y recuerdan actualizar el espejo del cliente.

describe('categoryTitle', () => {
  test('categoría activa → "<titulo> · UdelarHITS"', () => {
    expect(categoryTitle({ titulo: 'Cálculo I', estado: 'activa' })).toBe(`Cálculo I · ${SITE_NAME}`)
  })
  test('categoría inactiva → genérico', () => {
    expect(categoryTitle({ titulo: 'Cálculo I', estado: 'inactiva' })).toBe(BASE_TITLE)
  })
  test('sin datos (cargando/inexistente) → genérico', () => {
    expect(categoryTitle(null)).toBe(BASE_TITLE)
    expect(categoryTitle(undefined)).toBe(BASE_TITLE)
  })
})

describe('topicTitle', () => {
  test('tema activo en categoría activa → "<titulo> · <categoria> · UdelarHITS"', () => {
    expect(topicTitle({
      titulo: 'Duda de límites', categoria_titulo: 'Cálculo I',
      estado: 'activo', categoria_estado: 'activa',
    })).toBe(`Duda de límites · Cálculo I · ${SITE_NAME}`)
  })
  test('tema inactivo → genérico', () => {
    expect(topicTitle({
      titulo: 'Duda', categoria_titulo: 'Cálculo I',
      estado: 'inactivo', categoria_estado: 'activa',
    })).toBe(BASE_TITLE)
  })
  test('categoría inactiva → genérico', () => {
    expect(topicTitle({
      titulo: 'Duda', categoria_titulo: 'Cálculo I',
      estado: 'activo', categoria_estado: 'inactiva',
    })).toBe(BASE_TITLE)
  })
  test('sin datos → genérico', () => {
    expect(topicTitle(null)).toBe(BASE_TITLE)
  })
})

describe('commentTitle', () => {
  test('comentario visible con tema → "Comentario en <tema> · UdelarHITS"', () => {
    expect(commentTitle({ estado: 'visible', tema_titulo: 'Duda de límites', categoria_titulo: 'Cálculo I' }))
      .toBe(`Comentario en Duda de límites · ${SITE_NAME}`)
  })
  test('comentario visible sin tema usa la categoría', () => {
    expect(commentTitle({ estado: 'visible', tema_titulo: null, categoria_titulo: 'Cálculo I' }))
      .toBe(`Comentario en Cálculo I · ${SITE_NAME}`)
  })
  test('comentario de Home (sin ámbito) cae a UdelarHITS como contexto', () => {
    expect(commentTitle({ estado: 'visible', tema_titulo: null, categoria_titulo: null }))
      .toBe(`Comentario en ${SITE_NAME} · ${SITE_NAME}`)
  })
  test('comentario no visible → genérico', () => {
    expect(commentTitle({ estado: 'inactivo', tema_titulo: 'Duda' })).toBe(BASE_TITLE)
  })
  test('sin datos → genérico', () => {
    expect(commentTitle(null)).toBe(BASE_TITLE)
  })
})

describe('profileTitle', () => {
  test('cuenta activa pública → "<nickname> · UdelarHITS"', () => {
    expect(profileTitle({ nickname: 'ada', estado: 'activo', privado: false })).toBe(`ada · ${SITE_NAME}`)
  })
  test('cuenta activa privada expone solo el nickname (igual que la página/preview)', () => {
    expect(profileTitle({ nickname: 'ada', estado: 'activo', privado: true })).toBe(`ada · ${SITE_NAME}`)
  })
  test('cuenta desactivada o baneada NO expone el nickname → "Perfil en UdelarHITS"', () => {
    // estado_usr = ('activo','inactivo','ban')
    expect(profileTitle({ nickname: 'ada', estado: 'inactivo', privado: false })).toBe(`Perfil en ${SITE_NAME}`)
    expect(profileTitle({ nickname: 'ada', estado: 'ban', privado: true })).toBe(`Perfil en ${SITE_NAME}`)
  })
  test('inexistente → "Perfil en UdelarHITS"', () => {
    expect(profileTitle(null)).toBe(`Perfil en ${SITE_NAME}`)
  })
})
