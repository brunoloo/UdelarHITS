import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createAdmin, createTopic } from '../helpers.js';

// Confirmá estas URLs con el grep de topic.routes.js antes de correr
const patch = (id, cookie, body) =>
  request(app).patch(`/api/topics/${id}`).set('Cookie', cookie).send(body);
const del = (id, cookie) =>
  request(app).delete(`/api/topics/${id}/delete`).set('Cookie', cookie);

const idOf = (t) => t.id ?? t.contenido_id;  // tolera ambos nombres de PK

describe('permisos de tema — editar', () => {
  test('el autor puede editar su tema', async () => {
    const autor = await registerAndLogin();
    const topic = await createTopic(autor.cookie);
    const res = await patch(idOf(topic), autor.cookie, { cuerpo: 'Editado por el autor' });
    expect(res.status).toBe(200);
  });

  test('un no-autor NO puede editar → 403', async () => {
    const autor = await registerAndLogin();
    const otro = await registerAndLogin();
    const topic = await createTopic(autor.cookie);
    const res = await patch(idOf(topic), otro.cookie, { cuerpo: 'Intento ajeno' });
    expect(res.status).toBe(403);
  });

  test('un admin NO puede editar tema ajeno → 403 (regla unificada)', async () => {
    const autor = await registerAndLogin();
    const admin = await createAdmin();
    const topic = await createTopic(autor.cookie);
    const res = await patch(idOf(topic), admin.cookie, { cuerpo: 'Intento admin' });
    expect(res.status).toBe(403);
  });

  test('sin sesión NO se puede editar → 401', async () => {
    const autor = await registerAndLogin();
    const topic = await createTopic(autor.cookie);
    const res = await request(app).patch(`/api/topics/${idOf(topic)}`)
      .send({ cuerpo: 'Sin login' });
    expect(res.status).toBe(401);
  });
});

describe('permisos de tema — eliminar', () => {
  test('el autor puede eliminar su tema', async () => {
    const autor = await registerAndLogin();
    const topic = await createTopic(autor.cookie);
    const res = await del(idOf(topic), autor.cookie);
    expect(res.status).toBe(200);
  });

  test('un no-autor NO puede eliminar → 403', async () => {
    const autor = await registerAndLogin();
    const otro = await registerAndLogin();
    const topic = await createTopic(autor.cookie);
    const res = await del(idOf(topic), otro.cookie);
    expect(res.status).toBe(403);
  });

  test('un admin SÍ puede eliminar tema ajeno', async () => {
    const autor = await registerAndLogin();
    const admin = await createAdmin();
    const topic = await createTopic(autor.cookie);
    const res = await del(idOf(topic), admin.cookie);
    expect(res.status).toBe(200);
  });
});