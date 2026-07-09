import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createTopic, createReply } from '../helpers.js';

const idOf = (x) => x.id ?? x.contenido_id;
const crear = (cookie, body) =>
  request(app).post('/api/replies/create').set('Cookie', cookie).send(body);

describe('validación de creación de comentario', () => {
  test('cuerpo vacío → 400', async () => {
    const u = await registerAndLogin();
    const topic = await createTopic(u.cookie);
    const res = await crear(u.cookie, { cuerpo: '   ', tema_id: idOf(topic) });
    expect(res.status).toBe(400);
  });

  test('comentario válido en tema → 201', async () => {
    const u = await registerAndLogin();
    const topic = await createTopic(u.cookie);
    const res = await crear(u.cookie, { cuerpo: 'comentario válido', tema_id: idOf(topic) });
    expect(res.status).toBe(201);
  });

  test('sin ningún target (ni tema, ni categoría, ni padre) → 400', async () => {
    const u = await registerAndLogin();
    const res = await crear(u.cookie, { cuerpo: 'huérfano' });
    expect(res.status).toBe(400);
  });

  test('cuerpo de más de 5000 caracteres → 400', async () => {
    const u = await registerAndLogin();
    const topic = await createTopic(u.cookie);
    const res = await crear(u.cookie, { cuerpo: 'a'.repeat(5001), tema_id: idOf(topic) });
    expect(res.status).toBe(400);
  });

  test('comentar en tema inexistente → 404', async () => {
    const u = await registerAndLogin();
    const res = await crear(u.cookie, { cuerpo: 'hola', tema_id: 999999 });
    expect(res.status).toBe(404);
  });

  test('comentar en tema inactivo → 403', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const topic = await createTopic(a.cookie);
    // b comenta → al borrar, el tema queda inactivo
    await crear(b.cookie, { cuerpo: 'primero', tema_id: idOf(topic) });
    await request(app).delete(`/api/topics/${idOf(topic)}/delete`).set('Cookie', a.cookie);
    // intentar comentar en el tema ya inactivo
    const res = await crear(a.cookie, { cuerpo: 'tarde', tema_id: idOf(topic) });
    expect(res.status).toBe(403);
  });

  test('comentario padre inexistente → 404', async () => {
    const u = await registerAndLogin();
    const res = await crear(u.cookie, { cuerpo: 'respuesta', comentario_padre_id: 999999 });
    expect(res.status).toBe(404);
  });

  test('respuesta hereda el tema del comentario padre → 201', async () => {
    const u = await registerAndLogin();
    const topic = await createTopic(u.cookie);
    const padre = await crear(u.cookie, { cuerpo: 'padre', tema_id: idOf(topic) });
    expect(padre.status).toBe(201);
    // respuesta solo con padre_id, sin tema_id explícito → debe heredar y crear
    const res = await crear(u.cookie, { cuerpo: 'respuesta', comentario_padre_id: idOf(padre.body.data) });
    expect(res.status).toBe(201);
  });
});

const editar = (cookie, id, body) =>
  request(app).patch(`/api/replies/update/${id}`).set('Cookie', cookie).send(body);

describe('validación de edición de comentario', () => {
  test('cuerpo vacío → 400', async () => {
    const u = await registerAndLogin();
    const reply = await createReply(u.cookie);
    const id = reply.id ?? reply.contenido_id;
    const res = await editar(u.cookie, id, { cuerpo: '   ' });
    expect(res.status).toBe(400);
  });

  test('cuerpo de más de 5000 caracteres → 400', async () => {
    const u = await registerAndLogin();
    const reply = await createReply(u.cookie);
    const id = reply.id ?? reply.contenido_id;
    const res = await editar(u.cookie, id, { cuerpo: 'a'.repeat(5001) });
    expect(res.status).toBe(400);
  });

  test('edición válida → 200', async () => {
    const u = await registerAndLogin();
    const reply = await createReply(u.cookie);
    const id = reply.id ?? reply.contenido_id;
    const res = await editar(u.cookie, id, { cuerpo: 'Editado correctamente' });
    expect(res.status).toBe(200);
  });

  test('editar comentario ajeno → 403', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const reply = await createReply(a.cookie);
    const id = reply.id ?? reply.contenido_id;
    const res = await editar(b.cookie, id, { cuerpo: 'Intruso' });
    expect(res.status).toBe(403);
  });

  test('comentario inexistente → 404', async () => {
    const u = await registerAndLogin();
    const res = await editar(u.cookie, 999999, { cuerpo: 'Nada' });
    expect(res.status).toBe(404);
  });
});