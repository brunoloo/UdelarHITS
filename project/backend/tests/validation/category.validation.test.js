import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createCategory, createAdmin, getTagIds } from '../helpers.js';

const crear = (cookie, body) =>
  request(app).post('/api/categories/create').set('Cookie', cookie).send(body);

let validTagIds;
beforeAll(async () => {
  validTagIds = await getTagIds(['Programación']);
});

const base = (over = {}) => ({
  titulo: 'Cat ' + Math.random().toString(36).slice(2, 8),
  descripcion: 'Descripción válida',
  etiquetas: validTagIds,
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

  test('descripción de más de 750 caracteres → 400', async () => {
    const u = await registerAndLogin();
    const res = await crear(u.cookie, base({ descripcion: 'a'.repeat(751) }));
    expect(res.status).toBe(400);
  });

  test('etiqueta con ID inexistente → 400', async () => {
    const u = await registerAndLogin();
    const res = await crear(u.cookie, base({ etiquetas: [999999] }));
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
    const segunda = await crear(u.cookie, base({ titulo: TITULO }));
    expect(segunda.status).toBe(409);
  });

  test('título duplicado es case-insensitive → 409', async () => {
    const u = await registerAndLogin();
    const TITULO = 'MiCategoria_' + Math.random().toString(36).slice(2, 8);
    await crear(u.cookie, base({ titulo: TITULO }));
    const res = await crear(u.cookie, base({ titulo: TITULO.toUpperCase() }));
    expect(res.status).toBe(409);
  });
});

const editar = (cookie, id, body) =>
  request(app).patch(`/api/categories/${id}`).set('Cookie', cookie).send(body);

describe('validación de edición de categoría', () => {
  test('descripción de más de 750 caracteres → 400', async () => {
    const u = await registerAndLogin();
    const cat = await createCategory(u.cookie);
    const res = await editar(u.cookie, cat.id, { descripcion: 'a'.repeat(751) });
    expect(res.status).toBe(400);
  });

  test('etiqueta con ID inexistente → 400', async () => {
    const u = await registerAndLogin();
    const cat = await createCategory(u.cookie);
    const res = await editar(u.cookie, cat.id, { etiquetas: [999999] });
    expect(res.status).toBe(400);
  });

  test('edición válida → 200', async () => {
    const u = await registerAndLogin();
    const cat = await createCategory(u.cookie);
    const res = await editar(u.cookie, cat.id, { descripcion: 'Nueva descripción' });
    expect(res.status).toBe(200);
  });

  test('editar categoría ajena → 403', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const res = await editar(b.cookie, cat.id, { descripcion: 'Intruso' });
    expect(res.status).toBe(403);
  });

  test('categoría inexistente → 404', async () => {
    const u = await registerAndLogin();
    const res = await editar(u.cookie, 999999, { descripcion: 'Nada' });
    expect(res.status).toBe(404);
  });
});
