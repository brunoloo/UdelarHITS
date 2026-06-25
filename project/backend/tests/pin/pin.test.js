import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createCategory, createTopic, createReply } from '../helpers.js';

const topicId = (t) => t.id ?? t.contenido_id;
const catReplies = (id, cookie) => request(app).get(`/api/replies/category/${id}`).set('Cookie', cookie).then(r => r.body.data);
const topicReplies = (id, cookie) => request(app).get(`/api/replies/topic/${id}`).set('Cookie', cookie).then(r => r.body.data);
const catTopics = (id, cookie) => request(app).get(`/api/categories/${id}`).set('Cookie', cookie).then(r => r.body.data.topics);
const pinCat = (cookie, id, tipo, item_id) => request(app).post(`/api/categories/${id}/pin`).set('Cookie', cookie).send({ tipo, item_id });
const unpinCat = (cookie, id, tipo) => request(app).delete(`/api/categories/${id}/pin/${tipo}`).set('Cookie', cookie);
const pinTopic = (cookie, id, item_id) => request(app).post(`/api/topics/${id}/pin`).set('Cookie', cookie).send({ item_id });
const unpinTopic = (cookie, id) => request(app).delete(`/api/topics/${id}/pin`).set('Cookie', cookie);

describe('Fijar comentarios en categoría', () => {
  test('el creador fija un comentario: queda primero y con fijado=true', async () => {
    const mod = await registerAndLogin();
    const otro = await registerAndLogin();
    const cat = await createCategory(mod.cookie);
    await createReply(otro.cookie, { categoria_id: cat.id, cuerpo: 'primero en el tiempo' });
    const c2 = await createReply(otro.cookie, { categoria_id: cat.id, cuerpo: 'segundo, lo fijamos' });

    const res = await pinCat(mod.cookie, cat.id, 'comentario', c2.contenido_id);
    expect(res.status).toBe(200);

    const replies = await catReplies(cat.id, mod.cookie);
    expect(Number(replies[0].id)).toBe(Number(c2.contenido_id));
    expect(replies[0].fijado).toBe(true);
  });

  test('fijar otro comentario auto-desancla el anterior', async () => {
    const mod = await registerAndLogin();
    const cat = await createCategory(mod.cookie);
    const a = await createReply(mod.cookie, { categoria_id: cat.id, cuerpo: 'A' });
    const b = await createReply(mod.cookie, { categoria_id: cat.id, cuerpo: 'B' });

    await pinCat(mod.cookie, cat.id, 'comentario', a.contenido_id);
    await pinCat(mod.cookie, cat.id, 'comentario', b.contenido_id);

    const replies = await catReplies(cat.id, mod.cookie);
    const ra = replies.find(r => Number(r.id) === Number(a.contenido_id));
    const rb = replies.find(r => Number(r.id) === Number(b.contenido_id));
    expect(rb.fijado).toBe(true);
    expect(ra.fijado).toBe(false);
    expect(Number(replies[0].id)).toBe(Number(b.contenido_id));
  });

  test('desanclar quita el fijado', async () => {
    const mod = await registerAndLogin();
    const cat = await createCategory(mod.cookie);
    const a = await createReply(mod.cookie, { categoria_id: cat.id, cuerpo: 'A' });
    await pinCat(mod.cookie, cat.id, 'comentario', a.contenido_id);

    const res = await unpinCat(mod.cookie, cat.id, 'comentario');
    expect(res.status).toBe(200);
    const replies = await catReplies(cat.id, mod.cookie);
    expect(replies.find(r => Number(r.id) === Number(a.contenido_id)).fijado).toBe(false);
  });

  test('un no-creador no puede fijar → 403', async () => {
    const mod = await registerAndLogin();
    const otro = await registerAndLogin();
    const cat = await createCategory(mod.cookie);
    const a = await createReply(otro.cookie, { categoria_id: cat.id, cuerpo: 'A' });

    const res = await pinCat(otro.cookie, cat.id, 'comentario', a.contenido_id);
    expect(res.status).toBe(403);
  });

  test('fijar un comentario que no pertenece a la categoría → 400', async () => {
    const mod = await registerAndLogin();
    const cat = await createCategory(mod.cookie);
    const otraCat = await createCategory(mod.cookie);
    const ajeno = await createReply(mod.cookie, { categoria_id: otraCat.id, cuerpo: 'ajeno' });

    const res = await pinCat(mod.cookie, cat.id, 'comentario', ajeno.contenido_id);
    expect(res.status).toBe(400);
  });
});

describe('Fijar tema en categoría', () => {
  test('el creador fija un tema: queda primero con fijado=true', async () => {
    const mod = await registerAndLogin();
    const cat = await createCategory(mod.cookie);
    await createTopic(mod.cookie, { categoria_id: cat.id, titulo: 'Tema viejo' });
    const t2 = await createTopic(mod.cookie, { categoria_id: cat.id, titulo: 'Tema fijado' });

    const res = await pinCat(mod.cookie, cat.id, 'tema', topicId(t2));
    expect(res.status).toBe(200);

    const topics = await catTopics(cat.id, mod.cookie);
    expect(Number(topics[0].contenido_id)).toBe(Number(topicId(t2)));
    expect(topics[0].fijado).toBe(true);
  });
});

describe('Fijar comentario en tema', () => {
  test('el creador del tema fija un comentario: queda primero', async () => {
    const mod = await registerAndLogin();
    const otro = await registerAndLogin();
    const topic = await createTopic(mod.cookie);
    await createReply(otro.cookie, { tema_id: topicId(topic), cuerpo: 'c1' });
    const c2 = await createReply(otro.cookie, { tema_id: topicId(topic), cuerpo: 'c2 fijado' });

    const res = await pinTopic(mod.cookie, topicId(topic), c2.contenido_id);
    expect(res.status).toBe(200);

    const replies = await topicReplies(topicId(topic), mod.cookie);
    expect(Number(replies[0].id)).toBe(Number(c2.contenido_id));
    expect(replies[0].fijado).toBe(true);

    await unpinTopic(mod.cookie, topicId(topic));
    const after = await topicReplies(topicId(topic), mod.cookie);
    expect(after.find(r => Number(r.id) === Number(c2.contenido_id)).fijado).toBe(false);
  });

  test('un no-creador del tema no puede fijar → 403', async () => {
    const mod = await registerAndLogin();
    const otro = await registerAndLogin();
    const topic = await createTopic(mod.cookie);
    const c = await createReply(otro.cookie, { tema_id: topicId(topic), cuerpo: 'c' });

    const res = await pinTopic(otro.cookie, topicId(topic), c.contenido_id);
    expect(res.status).toBe(403);
  });
});
