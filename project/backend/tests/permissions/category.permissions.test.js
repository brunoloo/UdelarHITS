import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createAdmin, createCategory } from '../helpers.js';

const patch = (id, cookie, body) =>
  request(app).patch(`/api/categories/${id}`).set('Cookie', cookie).send(body);
const del = (id, cookie) =>
  request(app).delete(`/api/categories/${id}/delete`).set('Cookie', cookie);

describe('permisos de categoría — editar', () => {
  test('el autor puede editar su categoría', async () => {
    const autor = await registerAndLogin();
    const cat = await createCategory(autor.cookie);
    const res = await patch(cat.id, autor.cookie, { descripcion: 'Editada por el autor' });
    expect(res.status).toBe(200);
  });

  test('un usuario que no es el autor NO puede editar → 403', async () => {
    const autor = await registerAndLogin();
    const otro = await registerAndLogin();
    const cat = await createCategory(autor.cookie);
    const res = await patch(cat.id, otro.cookie, { descripcion: 'Intento ajeno' });
    expect(res.status).toBe(403);
  });

  test('un admin NO puede editar categoría ajena → 403', async () => {
  const autor = await registerAndLogin();
  const admin = await createAdmin();
  const cat = await createCategory(autor.cookie);
  const res = await patch(cat.id, admin.cookie, { descripcion: 'Editada por admin' });
  expect(res.status).toBe(403);
  });

  test('sin sesión NO se puede editar → 401', async () => {
    const autor = await registerAndLogin();
    const cat = await createCategory(autor.cookie);
    const res = await request(app).patch(`/api/categories/${cat.id}`)
      .send({ descripcion: 'Sin login' });
    expect(res.status).toBe(401);
  });
});

describe('permisos de categoría — eliminar', () => {
  test('el autor puede eliminar su categoría', async () => {
    const autor = await registerAndLogin();
    const cat = await createCategory(autor.cookie);
    const res = await del(cat.id, autor.cookie);
    expect(res.status).toBe(200);
  });

  test('un usuario que no es el autor NO puede eliminar → 403', async () => {
    const autor = await registerAndLogin();
    const otro = await registerAndLogin();
    const cat = await createCategory(autor.cookie);
    const res = await del(cat.id, otro.cookie);
    expect(res.status).toBe(403);
  });

  test('un admin SÍ puede eliminar categoría ajena', async () => {
    const autor = await registerAndLogin();
    const admin = await createAdmin();
    const cat = await createCategory(autor.cookie);
    const res = await del(cat.id, admin.cookie);
    expect(res.status).toBe(200);
  });
});