import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createAdmin, createReply } from '../helpers.js';

// Rutas de reply: el verbo va ANTES del id (distinto de tema/categoría)
const patch = (id, cookie, body) =>
  request(app).patch(`/api/replies/update/${id}`).set('Cookie', cookie).send(body);
const del = (id, cookie) =>
  request(app).delete(`/api/replies/delete/${id}`).set('Cookie', cookie);

const idOf = (r) => r.id ?? r.contenido_id;

describe('permisos de comentario — editar', () => {
  test('el autor puede editar su comentario', async () => {
    const autor = await registerAndLogin();
    const reply = await createReply(autor.cookie);
    const res = await patch(idOf(reply), autor.cookie, { cuerpo: 'Editado por el autor' });
    expect(res.status).toBe(200);
  });

  test('un no-autor NO puede editar → 403', async () => {
    const autor = await registerAndLogin();
    const otro = await registerAndLogin();
    const reply = await createReply(autor.cookie);
    const res = await patch(idOf(reply), otro.cookie, { cuerpo: 'Intento ajeno' });
    expect(res.status).toBe(403);
  });

  test('un admin NO puede editar comentario ajeno → 403 (regla unificada)', async () => {
    const autor = await registerAndLogin();
    const admin = await createAdmin();
    const reply = await createReply(autor.cookie);
    const res = await patch(idOf(reply), admin.cookie, { cuerpo: 'Intento admin' });
    expect(res.status).toBe(403);
  });

  test('sin sesión NO se puede editar → 401', async () => {
    const autor = await registerAndLogin();
    const reply = await createReply(autor.cookie);
    const res = await request(app).patch(`/api/replies/update/${idOf(reply)}`)
      .send({ cuerpo: 'Sin login' });
    expect(res.status).toBe(401);
  });
});

describe('permisos de comentario — eliminar', () => {
  test('el autor puede eliminar su comentario', async () => {
    const autor = await registerAndLogin();
    const reply = await createReply(autor.cookie);
    const res = await del(idOf(reply), autor.cookie);
    expect(res.status).toBe(200);
  });

  test('un no-autor NO puede eliminar → 403', async () => {
    const autor = await registerAndLogin();
    const otro = await registerAndLogin();
    const reply = await createReply(autor.cookie);
    const res = await del(idOf(reply), otro.cookie);
    expect(res.status).toBe(403);
  });

  test('un admin SÍ puede eliminar comentario ajeno', async () => {
    const autor = await registerAndLogin();
    const admin = await createAdmin();
    const reply = await createReply(autor.cookie);
    const res = await del(idOf(reply), admin.cookie);
    expect(res.status).toBe(200);
  });
});