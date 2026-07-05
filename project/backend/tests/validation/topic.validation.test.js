import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createCategory, createTopic } from '../helpers.js';

const crear = (cookie, body) =>
  request(app).post('/api/topics/create').set('Cookie', cookie).send(body);

describe('validación de creación de tema', () => {
  test('sin categoria_id → 400', async () => {
    const u = await registerAndLogin();
    const res = await crear(u.cookie, { titulo: 'T', cuerpo: 'cuerpo' });
    expect(res.status).toBe(400);
  });

  test('título vacío → 400', async () => {
    const u = await registerAndLogin();
    const cat = await createCategory(u.cookie);
    const res = await crear(u.cookie, { categoria_id: cat.id, titulo: '  ', cuerpo: 'cuerpo' });
    expect(res.status).toBe(400);
  });

  test('cuerpo vacío → 400', async () => {
    const u = await registerAndLogin();
    const cat = await createCategory(u.cookie);
    const res = await crear(u.cookie, { categoria_id: cat.id, titulo: 'Título', cuerpo: '' });
    expect(res.status).toBe(400);
  });

  test('título de más de 100 caracteres → 400', async () => {
    const u = await registerAndLogin();
    const cat = await createCategory(u.cookie);
    const res = await crear(u.cookie, { categoria_id: cat.id, titulo: 'a'.repeat(101), cuerpo: 'cuerpo' });
    expect(res.status).toBe(400);
  });

  test('cuerpo de más de 500 caracteres → 400', async () => {
    const u = await registerAndLogin();
    const cat = await createCategory(u.cookie);
    const res = await crear(u.cookie, { categoria_id: cat.id, titulo: 'Título', cuerpo: 'a'.repeat(501) });
    expect(res.status).toBe(400);
  });

  test('creación válida → 201', async () => {
    const u = await registerAndLogin();
    const cat = await createCategory(u.cookie);
    const res = await crear(u.cookie, { categoria_id: cat.id, titulo: 'Título válido', cuerpo: 'cuerpo' });
    expect(res.status).toBe(201);
  });

  test('categoría inexistente → 404', async () => {
    const u = await registerAndLogin();
    const res = await crear(u.cookie, { categoria_id: 999999, titulo: 'Título', cuerpo: 'cuerpo' });
    expect(res.status).toBe(404);
  });

  test('no se puede crear tema en categoría inactiva → 403', async () => {
    const u = await registerAndLogin();
    const otro = await registerAndLogin();
    const cat = await createCategory(u.cookie);
    // un comentario de otro hace que el borrado sea soft (categoría queda inactiva)
    await request(app).post('/api/replies/create')
      .set('Cookie', otro.cookie).send({ cuerpo: 'c', categoria_id: cat.id });
    await request(app).delete(`/api/categories/${cat.id}/delete`).set('Cookie', u.cookie);
    // ahora intentar crear un tema en esa categoría inactiva
    const res = await crear(u.cookie, { categoria_id: cat.id, titulo: 'Nuevo', cuerpo: 'cuerpo' });
    expect(res.status).toBe(403);
  });

  test('título duplicado en la MISMA categoría → 409', async () => {
    const u = await registerAndLogin();
    const cat = await createCategory(u.cookie);
    const TITULO = 'TemaRepetido_' + Math.random().toString(36).slice(2, 8);
    const primero = await crear(u.cookie, { categoria_id: cat.id, titulo: TITULO, cuerpo: 'cuerpo' });
    expect(primero.status).toBe(201);
    const segundo = await crear(u.cookie, { categoria_id: cat.id, titulo: TITULO, cuerpo: 'otro cuerpo' });
    expect(segundo.status).toBe(409);
  });

  test('mismo título en DISTINTA categoría → 201 (unicidad es por categoría)', async () => {
    const u = await registerAndLogin();
    const cat1 = await createCategory(u.cookie);
    const cat2 = await createCategory(u.cookie);
    const TITULO = 'TemaEnDos_' + Math.random().toString(36).slice(2, 8);
    const enCat1 = await crear(u.cookie, { categoria_id: cat1.id, titulo: TITULO, cuerpo: 'cuerpo' });
    expect(enCat1.status).toBe(201);
    // mismo título, otra categoría: debe permitirse
    const enCat2 = await crear(u.cookie, { categoria_id: cat2.id, titulo: TITULO, cuerpo: 'cuerpo' });
    expect(enCat2.status).toBe(201);
  });
});

const editar = (cookie, id, body) =>
  request(app).patch(`/api/topics/${id}`).set('Cookie', cookie).send(body);

describe('validación de edición de tema', () => {
  test('cuerpo vacío → 400', async () => {
    const u = await registerAndLogin();
    const topic = await createTopic(u.cookie);
    const id = topic.id ?? topic.contenido_id;
    const res = await editar(u.cookie, id, { cuerpo: '   ' });
    expect(res.status).toBe(400);
  });

  test('cuerpo de más de 500 caracteres → 400', async () => {
    const u = await registerAndLogin();
    const topic = await createTopic(u.cookie);
    const id = topic.id ?? topic.contenido_id;
    const res = await editar(u.cookie, id, { cuerpo: 'a'.repeat(501) });
    expect(res.status).toBe(400);
  });

  test('edición válida → 200', async () => {
    const u = await registerAndLogin();
    const topic = await createTopic(u.cookie);
    const id = topic.id ?? topic.contenido_id;
    const res = await editar(u.cookie, id, { cuerpo: 'Cuerpo editado' });
    expect(res.status).toBe(200);
  });

  test('editar tema ajeno → 403', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const topic = await createTopic(a.cookie);
    const id = topic.id ?? topic.contenido_id;
    const res = await editar(b.cookie, id, { cuerpo: 'Intruso' });
    expect(res.status).toBe(403);
  });

  test('tema inexistente → 404', async () => {
    const u = await registerAndLogin();
    const res = await editar(u.cookie, 999999, { cuerpo: 'Nada' });
    expect(res.status).toBe(404);
  });
});