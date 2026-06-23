import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createCategory, createReply, createTopic } from '../helpers.js';

describe('GET /api/replies/:id/context', () => {
  let userA, cat;

  beforeEach(async () => {
    userA = await registerAndLogin();
    cat = await createCategory(userA.cookie);
  });

  it('devuelve la cadena de ancestros ordenada raíz→hoja', async () => {
    const root = await createReply(userA.cookie, { categoria_id: cat.id });
    const child = await createReply(userA.cookie, { comentario_padre_id: root.contenido_id });
    const grandchild = await createReply(userA.cookie, { comentario_padre_id: child.contenido_id });

    const res = await request(app)
      .get(`/api/replies/${grandchild.contenido_id}/context`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.data[0].id).toBe(root.contenido_id);
    expect(res.body.data[1].id).toBe(child.contenido_id);
    expect(res.body.data[2].id).toBe(grandchild.contenido_id);
  });

  it('un comentario raíz devuelve solo sí mismo', async () => {
    const root = await createReply(userA.cookie, { categoria_id: cat.id });

    const res = await request(app)
      .get(`/api/replies/${root.contenido_id}/context`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(root.contenido_id);
  });

  it('incluye likes y mi_reaccion con autenticación', async () => {
    const root = await createReply(userA.cookie, { categoria_id: cat.id });

    await request(app)
      .post(`/api/reactions/${root.contenido_id}`)
      .set('Cookie', userA.cookie)
      .send({ tipo: 'meGusta' });

    const res = await request(app)
      .get(`/api/replies/${root.contenido_id}/context`)
      .set('Cookie', userA.cookie);

    expect(res.status).toBe(200);
    expect(Number(res.body.data[0].likes)).toBe(1);
    expect(res.body.data[0].mi_reaccion).toBe('meGusta');
  });

  it('devuelve mi_reaccion null sin autenticación', async () => {
    const root = await createReply(userA.cookie, { categoria_id: cat.id });

    await request(app)
      .post(`/api/reactions/${root.contenido_id}`)
      .set('Cookie', userA.cookie)
      .send({ tipo: 'meGusta' });

    const res = await request(app)
      .get(`/api/replies/${root.contenido_id}/context`);

    expect(res.status).toBe(200);
    expect(Number(res.body.data[0].likes)).toBe(1);
    expect(res.body.data[0].mi_reaccion).toBeNull();
  });

  it('404 para comentario inexistente', async () => {
    const res = await request(app)
      .get('/api/replies/999999/context');

    expect(res.status).toBe(404);
  });

  it('400 para id no numérico', async () => {
    const res = await request(app)
      .get('/api/replies/abc/context');

    expect(res.status).toBe(400);
  });

  it('funciona con comentarios en temas', async () => {
    const topic = await createTopic(userA.cookie, { categoria_id: cat.id });
    const topicId = topic.id ?? topic.contenido_id;
    const root = await createReply(userA.cookie, { tema_id: topicId });
    const child = await createReply(userA.cookie, { comentario_padre_id: root.contenido_id });

    const res = await request(app)
      .get(`/api/replies/${child.contenido_id}/context`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].id).toBe(root.contenido_id);
    expect(res.body.data[1].id).toBe(child.contenido_id);
  });
});
