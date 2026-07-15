import { describe, test, expect } from 'vitest'
import { avatarThumbnail } from '../cloudinaryUrl'

const RAW = 'https://res.cloudinary.com/xx/image/upload/v1712345678/udelarhits/avatars/avatar_5.jpg'

describe('avatarThumbnail', () => {
  test('inserta la transformación en una URL cruda (con versión)', () => {
    expect(avatarThumbnail(RAW, 80)).toBe(
      'https://res.cloudinary.com/xx/image/upload/c_fill,w_96,h_96,f_auto,q_auto/v1712345678/udelarhits/avatars/avatar_5.jpg'
    )
  })

  test('REEMPLAZA una transformación previa en vez de apilar', () => {
    const conTransform =
      'https://res.cloudinary.com/xx/image/upload/f_auto,q_auto/v123/udelarhits/avatars/abc.jpg'
    const out = avatarThumbnail(conTransform, 80)
    expect(out).toBe(
      'https://res.cloudinary.com/xx/image/upload/c_fill,w_96,h_96,f_auto,q_auto/v123/udelarhits/avatars/abc.jpg'
    )
    // Nunca dos cadenas f_auto (señal de apilamiento).
    expect(out.split('f_auto').length).toBe(2)
  })

  test('es idempotente sobre su propia salida', () => {
    const once = avatarThumbnail(RAW, 80)
    expect(avatarThumbnail(once, 80)).toBe(once)
  })

  test('bucketiza los tamaños (chat/listas → 96, perfil → 192, cap 400)', () => {
    expect(avatarThumbnail(RAW, 56)).toContain('w_96,h_96')
    expect(avatarThumbnail(RAW, 80)).toContain('w_96,h_96')
    expect(avatarThumbnail(RAW, 176)).toContain('w_192,h_192')
    expect(avatarThumbnail(RAW, 640)).toContain('w_400,h_400')
  })

  test('funciona sin número de versión (defensivo)', () => {
    const sinVersion = 'https://res.cloudinary.com/xx/image/upload/udelarhits/avatars/abc.jpg'
    expect(avatarThumbnail(sinVersion, 80)).toBe(
      'https://res.cloudinary.com/xx/image/upload/c_fill,w_96,h_96,f_auto,q_auto/udelarhits/avatars/abc.jpg'
    )
  })

  test('deja intactas las URLs que no son de Cloudinary', () => {
    expect(avatarThumbnail('https://otra-cdn.com/foto.png', 80)).toBe('https://otra-cdn.com/foto.png')
    expect(avatarThumbnail('data:image/png;base64,AAAA', 80)).toBe('data:image/png;base64,AAAA')
    expect(avatarThumbnail(null, 80)).toBe(null)
    expect(avatarThumbnail('', 80)).toBe('')
  })
})
