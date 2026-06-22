import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createAdmin, createCategory, createReply, createTopic } from '../helpers.js';

// ─── Toggle: crear reacciones ───

describe('POST /api/reactions/:contenidoId — toggle', () => {
  let userA, reply;

  beforeEach(async () => {
    userA = await registerAndLogin();
    reply = await createReply(userA.cookie, { categoria_id: (await createCategory(userA.cookie)).id });
  });

  it('crea un meGusta donde no había reacción', async () => {
    const res = await request(app)
      .post(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', userA.cookie)
      .send({ tipo: 'meGusta' });

    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('created');
    expect(res.body.data.mi_reaccion).toBe('meGusta');
    expect(res.body.data.likes).toBe(1);
    expect(res.body.data.dislikes).toBe(0);
  });

  it('crea un noMeGusta donde no había reacción', async () => {
    const res = await request(app)
      .post(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', userA.cookie)
      .send({ tipo: 'noMeGusta' });

    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('created');
    expect(res.body.data.mi_reaccion).toBe('noMeGusta');
    expect(res.body.data.likes).toBe(0);
    expect(res.body.data.dislikes).toBe(1);
  });

  it('toggle off: repetir meGusta elimina la reacción', async () => {
    await request(app)
      .post(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', userA.cookie)
      .send({ tipo: 'meGusta' });

    const res = await request(app)
      .post(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', userA.cookie)
      .send({ tipo: 'meGusta' });

    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('removed');
    expect(res.body.data.mi_reaccion).toBeNull();
    expect(res.body.data.likes).toBe(0);
  });

  it('toggle off: repetir noMeGusta elimina la reacción', async () => {
    await request(app)
      .post(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', userA.cookie)
      .send({ tipo: 'noMeGusta' });

    const res = await request(app)
      .post(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', userA.cookie)
      .send({ tipo: 'noMeGusta' });

    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('removed');
    expect(res.body.data.mi_reaccion).toBeNull();
    expect(res.body.data.dislikes).toBe(0);
  });

  it('switch: de meGusta a noMeGusta', async () => {
    await request(app)
      .post(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', userA.cookie)
      .send({ tipo: 'meGusta' });

    const res = await request(app)
      .post(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', userA.cookie)
      .send({ tipo: 'noMeGusta' });

    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('changed');
    expect(res.body.data.mi_reaccion).toBe('noMeGusta');
    expect(res.body.data.likes).toBe(0);
    expect(res.body.data.dislikes).toBe(1);
  });

  it('switch: de noMeGusta a meGusta', async () => {
    await request(app)
      .post(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', userA.cookie)
      .send({ tipo: 'noMeGusta' });

    const res = await request(app)
      .post(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', userA.cookie)
      .send({ tipo: 'meGusta' });

    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('changed');
    expect(res.body.data.mi_reaccion).toBe('meGusta');
    expect(res.body.data.likes).toBe(1);
    expect(res.body.data.dislikes).toBe(0);
  });
});

// ─── Validaciones ───

describe('POST /api/reactions/:contenidoId — validaciones', () => {
  let userA, reply;

  beforeEach(async () => {
    userA = await registerAndLogin();
    reply = await createReply(userA.cookie, { categoria_id: (await createCategory(userA.cookie)).id });
  });

  it('rechaza tipo inválido', async () => {
    const res = await request(app)
      .post(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', userA.cookie)
      .send({ tipo: 'invalido' });

    expect(res.status).toBe(400);
  });

  it('rechaza tipo vacío', async () => {
    const res = await request(app)
      .post(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', userA.cookie)
      .send({});

    expect(res.status).toBe(400);
  });

  it('rechaza contenido inexistente', async () => {
    const res = await request(app)
      .post('/api/reactions/999999')
      .set('Cookie', userA.cookie)
      .send({ tipo: 'meGusta' });

    expect(res.status).toBe(404);
  });

  it('rechaza contenidoId no numérico', async () => {
    const res = await request(app)
      .post('/api/reactions/abc')
      .set('Cookie', userA.cookie)
      .send({ tipo: 'meGusta' });

    expect(res.status).toBe(400);
  });

  it('rechaza sin autenticación', async () => {
    const res = await request(app)
      .post(`/api/reactions/${reply.contenido_id}`)
      .send({ tipo: 'meGusta' });

    expect(res.status).toBe(401);
  });

  it('rechaza reacción a comentario oculto', async () => {
    // Ocultar el comentario (eliminar como autor → soft delete si tiene respuestas,
    // pero este no tiene respuestas así que es hard delete. Necesitamos uno con respuestas.)
    // Crear una respuesta para que el padre haga soft delete
    const userB = await registerAndLogin();
    const parentReply = await createReply(userA.cookie, { categoria_id: (await createCategory(userA.cookie)).id });
    await createReply(userB.cookie, { comentario_padre_id: parentReply.contenido_id });

    // Eliminar el padre → soft delete (queda oculto porque tiene respuesta)
    await request(app)
      .delete(`/api/replies/delete/${parentReply.contenido_id}`)
      .set('Cookie', userA.cookie);

    const res = await request(app)
      .post(`/api/reactions/${parentReply.contenido_id}`)
      .set('Cookie', userB.cookie)
      .send({ tipo: 'meGusta' });

    expect(res.status).toBe(403);
  });
});

// ─── Conteos con múltiples usuarios ───

describe('Conteos de reacciones con múltiples usuarios', () => {
  let userA, userB, userC, reply;

  beforeEach(async () => {
    userA = await registerAndLogin();
    userB = await registerAndLogin();
    userC = await registerAndLogin();
    const cat = await createCategory(userA.cookie);
    reply = await createReply(userA.cookie, { categoria_id: cat.id });
  });

  it('acumula likes de distintos usuarios', async () => {
    await request(app)
      .post(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', userA.cookie)
      .send({ tipo: 'meGusta' });

    await request(app)
      .post(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', userB.cookie)
      .send({ tipo: 'meGusta' });

    const res = await request(app)
      .post(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', userC.cookie)
      .send({ tipo: 'meGusta' });

    expect(res.body.data.likes).toBe(3);
    expect(res.body.data.dislikes).toBe(0);
  });

  it('mezcla likes y dislikes correctamente', async () => {
    await request(app)
      .post(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', userA.cookie)
      .send({ tipo: 'meGusta' });

    await request(app)
      .post(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', userB.cookie)
      .send({ tipo: 'noMeGusta' });

    const res = await request(app)
      .post(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', userC.cookie)
      .send({ tipo: 'meGusta' });

    expect(res.body.data.likes).toBe(2);
    expect(res.body.data.dislikes).toBe(1);
  });

  it('un usuario quita su like, el conteo baja', async () => {
    await request(app)
      .post(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', userA.cookie)
      .send({ tipo: 'meGusta' });

    await request(app)
      .post(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', userB.cookie)
      .send({ tipo: 'meGusta' });

    // userA quita su like
    const res = await request(app)
      .post(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', userA.cookie)
      .send({ tipo: 'meGusta' });

    expect(res.body.data.likes).toBe(1);
    expect(res.body.data.mi_reaccion).toBeNull();
  });
});

// ─── GET endpoint ───

describe('GET /api/reactions/:contenidoId', () => {
  let userA, userB, reply;

  beforeEach(async () => {
    userA = await registerAndLogin();
    userB = await registerAndLogin();
    const cat = await createCategory(userA.cookie);
    reply = await createReply(userA.cookie, { categoria_id: cat.id });
  });

  it('devuelve conteos sin autenticación', async () => {
    await request(app)
      .post(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', userA.cookie)
      .send({ tipo: 'meGusta' });

    const res = await request(app)
      .get(`/api/reactions/${reply.contenido_id}`);

    expect(res.status).toBe(200);
    expect(res.body.data.likes).toBe(1);
    expect(res.body.data.dislikes).toBe(0);
    expect(res.body.data.mi_reaccion).toBeNull();
  });

  it('devuelve mi_reaccion cuando está autenticado', async () => {
    await request(app)
      .post(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', userA.cookie)
      .send({ tipo: 'meGusta' });

    const res = await request(app)
      .get(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', userA.cookie);

    expect(res.body.data.mi_reaccion).toBe('meGusta');
  });

  it('mi_reaccion es null para otro usuario sin reacción', async () => {
    await request(app)
      .post(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', userA.cookie)
      .send({ tipo: 'meGusta' });

    const res = await request(app)
      .get(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', userB.cookie);

    expect(res.body.data.likes).toBe(1);
    expect(res.body.data.mi_reaccion).toBeNull();
  });
});

// ─── Reacciones en queries de comentarios ───

describe('Reacciones incluidas en queries de comentarios', () => {
  let userA, userB, cat, reply;

  beforeEach(async () => {
    userA = await registerAndLogin();
    userB = await registerAndLogin();
    cat = await createCategory(userA.cookie);
    reply = await createReply(userA.cookie, { categoria_id: cat.id });

    // userA le da like, userB le da dislike
    await request(app)
      .post(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', userA.cookie)
      .send({ tipo: 'meGusta' });

    await request(app)
      .post(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', userB.cookie)
      .send({ tipo: 'noMeGusta' });
  });

  it('GET /replies/category/:id incluye likes, dislikes y mi_reaccion (autenticado)', async () => {
    const res = await request(app)
      .get(`/api/replies/category/${cat.id}`)
      .set('Cookie', userA.cookie);

    expect(res.status).toBe(200);
    const comment = res.body.data.find(c => c.id === reply.contenido_id);
    expect(comment).toBeDefined();
    expect(Number(comment.likes)).toBe(1);
    expect(Number(comment.dislikes)).toBe(1);
    expect(comment.mi_reaccion).toBe('meGusta');
  });

  it('GET /replies/category/:id devuelve mi_reaccion null sin autenticación', async () => {
    const res = await request(app)
      .get(`/api/replies/category/${cat.id}`);

    expect(res.status).toBe(200);
    const comment = res.body.data.find(c => c.id === reply.contenido_id);
    expect(Number(comment.likes)).toBe(1);
    expect(Number(comment.dislikes)).toBe(1);
    expect(comment.mi_reaccion).toBeNull();
  });

  it('GET /replies/topic/:id incluye reacciones', async () => {
    const topic = await createTopic(userA.cookie, { categoria_id: cat.id });
    const topicReply = await createReply(userA.cookie, { tema_id: topic.id ?? topic.contenido_id });

    await request(app)
      .post(`/api/reactions/${topicReply.contenido_id}`)
      .set('Cookie', userB.cookie)
      .send({ tipo: 'meGusta' });

    const res = await request(app)
      .get(`/api/replies/topic/${topic.id ?? topic.contenido_id}`)
      .set('Cookie', userB.cookie);

    expect(res.status).toBe(200);
    const comment = res.body.data.find(c => c.id === topicReply.contenido_id);
    expect(Number(comment.likes)).toBe(1);
    expect(comment.mi_reaccion).toBe('meGusta');
  });

  it('GET /replies/:id/replies incluye reacciones en respuestas hijas', async () => {
    const child = await createReply(userB.cookie, { comentario_padre_id: reply.contenido_id });

    await request(app)
      .post(`/api/reactions/${child.contenido_id}`)
      .set('Cookie', userA.cookie)
      .send({ tipo: 'meGusta' });

    const res = await request(app)
      .get(`/api/replies/${reply.contenido_id}/replies`)
      .set('Cookie', userA.cookie);

    expect(res.status).toBe(200);
    const childComment = res.body.data.find(c => c.id === child.contenido_id);
    expect(Number(childComment.likes)).toBe(1);
    expect(childComment.mi_reaccion).toBe('meGusta');
  });

  it('mi_reaccion refleja la reacción del usuario que consulta, no de otros', async () => {
    // userB tiene noMeGusta
    const res = await request(app)
      .get(`/api/replies/category/${cat.id}`)
      .set('Cookie', userB.cookie);

    const comment = res.body.data.find(c => c.id === reply.contenido_id);
    expect(comment.mi_reaccion).toBe('noMeGusta');
  });
});