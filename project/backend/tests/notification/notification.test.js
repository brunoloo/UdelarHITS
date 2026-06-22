import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createCategory, createReply, createTopic } from '../helpers.js';

// ─── Notificaciones de respuesta ───

describe('Notificaciones de respuesta a comentario', () => {
  let userA, userB, cat, parent;

  beforeEach(async () => {
    userA = await registerAndLogin();
    userB = await registerAndLogin();
    cat = await createCategory(userA.cookie);
    parent = await createReply(userA.cookie, { categoria_id: cat.id });
  });

  it('responder comentario ajeno genera notificación al autor', async () => {
    await createReply(userB.cookie, { comentario_padre_id: parent.contenido_id });

    const res = await request(app).get('/api/notifications').set('Cookie', userA.cookie);
    expect(res.status).toBe(200);
    const notif = res.body.data.find(n => n.tipo === 'respuesta_comentario');
    expect(notif).toBeDefined();
    expect(notif.actor_nickname).toBe(userB.user.nickname);
  });

  it('responder comentario propio no genera notificación', async () => {
    await createReply(userA.cookie, { comentario_padre_id: parent.contenido_id });

    const res = await request(app).get('/api/notifications').set('Cookie', userA.cookie);
    expect(res.body.data.filter(n => n.tipo === 'respuesta_comentario')).toHaveLength(0);
  });

  it('notificación de respuesta tiene url al tema/categoría correcta', async () => {
    // Comentario padre en categoría → url /category/{id}
    await createReply(userB.cookie, { comentario_padre_id: parent.contenido_id });
    let res = await request(app).get('/api/notifications').set('Cookie', userA.cookie);
    let notif = res.body.data.find(n => n.tipo === 'respuesta_comentario');
    expect(notif.url).toBe(`/category/${cat.id}`);

    // Comentario padre en tema → url /topic/{id}
    const topic = await createTopic(userA.cookie, { categoria_id: cat.id });
    const topicId = topic.id ?? topic.contenido_id;
    const topicParent = await createReply(userA.cookie, { tema_id: topicId });
    await createReply(userB.cookie, { comentario_padre_id: topicParent.contenido_id });

    res = await request(app).get('/api/notifications').set('Cookie', userA.cookie);
    notif = res.body.data.find(n => n.tipo === 'respuesta_comentario' && n.url === `/topic/${topicId}`);
    expect(notif).toBeDefined();
  });
});

// ─── Notificaciones de follow ───

describe('Notificaciones de nuevo seguidor', () => {
  let userA, userB;

  beforeEach(async () => {
    userA = await registerAndLogin();
    userB = await registerAndLogin();
  });

  const follow = (followerCookie, targetNick) => request(app)
    .post(`/api/users/${targetNick}/follow`).set('Cookie', followerCookie);
  const unfollow = (followerCookie, targetNick) => request(app)
    .delete(`/api/users/${targetNick}/follow`).set('Cookie', followerCookie);

  it('seguir a un usuario genera notificación', async () => {
    await follow(userA.cookie, userB.user.nickname);

    const res = await request(app).get('/api/notifications').set('Cookie', userB.cookie);
    expect(res.status).toBe(200);
    const notif = res.body.data.find(n => n.tipo === 'nuevo_seguidor');
    expect(notif).toBeDefined();
    expect(notif.actor_nickname).toBe(userA.user.nickname);
  });

  it('unfollow y re-follow no duplica notificación', async () => {
    await follow(userA.cookie, userB.user.nickname);
    await unfollow(userA.cookie, userB.user.nickname);
    await follow(userA.cookie, userB.user.nickname);

    const res = await request(app).get('/api/notifications').set('Cookie', userB.cookie);
    expect(res.body.data.filter(n => n.tipo === 'nuevo_seguidor')).toHaveLength(1);
  });

  it('notificación de follow tiene url al perfil del seguidor', async () => {
    await follow(userA.cookie, userB.user.nickname);

    const res = await request(app).get('/api/notifications').set('Cookie', userB.cookie);
    const notif = res.body.data.find(n => n.tipo === 'nuevo_seguidor');
    expect(notif.url).toBe(`/user/${userA.user.nickname}`);
  });
});
