import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createCategory } from '../helpers.js';

const crear = (cookie, body) =>
  request(app).post('/api/categories/create').set('Cookie', cookie).send(body);

const base = (over = {}) => ({
  titulo: 'Cat ' + Math.random().toString(36).slice(2, 8),
  descripcion: 'Descripción válida',
  etiquetas: ['Programación'],
  ...over,
});

describe('validación de creación de categoría', () => {
  test('título vacío → 400', async () => {
    const u = await registerAndLogin();
    const res = await crear(u.cookie, base({ titulo: '   ' }));
    expect(res.status).toBe(400);
  });

  test('descripción vacía → 400', async () => {
    const u = await registerAndLogin();
    const res = await crear(u.cookie, base({ descripcion: '' }));
    expect(res.status).toBe(400);
  });

  test('sin etiquetas → 400', async () => {
    const u = await registerAndLogin();
    const res = await crear(u.cookie, base({ etiquetas: [] }));
    expect(res.status).toBe(400);
  });

  test('título de más de 100 caracteres → 400', async () => {
    const u = await registerAndLogin();
    const res = await crear(u.cookie, base({ titulo: 'a'.repeat(101) }));
    expect(res.status).toBe(400);
  });

  test('descripción de más de 500 caracteres → 400', async () => {
    const u = await registerAndLogin();
    const res = await crear(u.cookie, base({ descripcion: 'a'.repeat(501) }));
    expect(res.status).toBe(400);
  });

  test('etiqueta fuera del enum → 400', async () => {
    const u = await registerAndLogin();
    const res = await crear(u.cookie, base({ etiquetas: ['EtiquetaInventada'] }));
    expect(res.status).toBe(400);
  });

  test('creación válida → 201', async () => {
    const u = await registerAndLogin();
    const res = await crear(u.cookie, base());
    expect(res.status).toBe(201);
  });

  test('título duplicado → 409', async () => {
    const u = await registerAndLogin();
    const TITULO = 'CategoriaUnica_' + Math.random().toString(36).slice(2, 8);
    const primera = await crear(u.cookie, base({ titulo: TITULO }));
    expect(primera.status).toBe(201);
    // segunda con el mismo título
    const segunda = await crear(u.cookie, base({ titulo: TITULO }));
    expect(segunda.status).toBe(409);
  });

  test('título duplicado es case-insensitive → 409', async () => {
    const u = await registerAndLogin();
    const TITULO = 'MiCategoria_' + Math.random().toString(36).slice(2, 8);
    await crear(u.cookie, base({ titulo: TITULO }));
    // mismo título en mayúsculas debe colisionar (se guarda lowercase)
    const res = await crear(u.cookie, base({ titulo: TITULO.toUpperCase() }));
    expect(res.status).toBe(409);
  });
});