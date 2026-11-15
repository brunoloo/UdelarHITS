import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createCategory, createTopic, createReply } from '../helpers.js';

let alice, bob;

beforeEach(async () => {
  alice = await registerAndLogin({ nickname: 'alice' });
  bob = await registerAndLogin({ nickname: 'bob' });
});

describe('Bloqueo de usuarios', () => {
  test('no se puede bloquear a uno mismo', async () => {
    const res = await request(app)
      .post(`/api/users/${alice.user.nickname}/block`)
      .set('Cookie', alice.cookie);
    expect(res.status).toBe(400);
  });

  test('bloquear usuario devuelve 200', async () => {
    const res = await request(app)
      .post(`/api/users/${bob.user.nickname}/block`)
      .set('Cookie', alice.cookie);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('bloquear elimina follows en ambas direcciones', async () => {
    // alice sigue a bob
    await request(app)
      .post(`/api/users/${bob.user.nickname}/follow`)
      .set('Cookie', alice.cookie);
    // bob sigue a alice
    await request(app)
      .post(`/api/users/${alice.user.nickname}/follow`)
      .set('Cookie', bob.cookie);

    // verificar seguimiento
    let res = await request(app)
      .get(`/api/users/${bob.user.nickname}/following`)
      .set('Cookie', alice.cookie);
    expect(res.body.data.following).toBe(true);

    // alice bloquea a bob
    await request(app)
      .post(`/api/users/${bob.user.nickname}/block`)
      .set('Cookie', alice.cookie);

    // ya no se siguen
    res = await request(app)
      .get(`/api/users/${bob.user.nickname}/following`)
      .set('Cookie', alice.cookie);
    expect(res.body.data.following).toBe(false);

    res = await request(app)
      .get(`/api/users/${alice.user.nickname}/following`)
      .set('Cookie', bob.cookie);
    expect(res.body.data.following).toBe(false);
  });

  test('usuario bloqueado no puede seguir', async () => {
    await request(app)
      .post(`/api/users/${bob.user.nickname}/block`)
      .set('Cookie', alice.cookie);

    const res = await request(app)
      .post(`/api/users/${alice.user.nickname}/follow`)
      .set('Cookie', bob.cookie);
    expect(res.status).toBe(403);
  });

  test('bloqueador no puede seguir al bloqueado', async () => {
    await request(app)
      .post(`/api/users/${bob.user.nickname}/block`)
      .set('Cookie', alice.cookie);

    const res = await request(app)
      .post(`/api/users/${bob.user.nickname}/follow`)
      .set('Cookie', alice.cookie);
    expect(res.status).toBe(403);
  });

  test('usuario bloqueado no puede responder a comentarios del bloqueador', async () => {
    const cat = await createCategory(alice.cookie);
    const topic = await createTopic(alice.cookie, { categoria_id: cat.id });
    const reply = await createReply(alice.cookie, { tema_id: topic.id ?? topic.contenido_id });

    await request(app)
      .post(`/api/users/${bob.user.nickname}/block`)
      .set('Cookie', alice.cookie);

    const res = await request(app)
      .post('/api/replies/create')
      .set('Cookie', bob.cookie)
      .send({ cuerpo: 'respuesta', comentario_padre_id: reply.contenido_id });
    expect(res.status).toBe(403);
  });

  test('usuario bloqueado no puede dar like a contenido del bloqueador', async () => {
    const cat = await createCategory(alice.cookie);
    const topic = await createTopic(alice.cookie, { categoria_id: cat.id });
    const reply = await createReply(alice.cookie, { tema_id: topic.id ?? topic.contenido_id });

    await request(app)
      .post(`/api/users/${bob.user.nickname}/block`)
      .set('Cookie', alice.cookie);

    const res = await request(app)
      .post(`/api/reactions/${reply.contenido_id}`)
      .set('Cookie', bob.cookie)
      .send({ tipo: 'meGusta' });
    expect(res.status).toBe(403);
  });

  test('usuario bloqueado no aparece en búsqueda', async () => {
    await request(app)
      .post(`/api/users/${bob.user.nickname}/block`)
      .set('Cookie', alice.cookie);

    const res = await request(app)
      .get(`/api/users/search?q=bob`)
      .set('Cookie', alice.cookie);
    expect(res.status).toBe(200);
    const nicks = res.body.data.map(u => u.nickname);
    expect(nicks).not.toContain('bob');
  });

  test('perfil bloqueado devuelve te_bloqueo: true', async () => {
    await request(app)
      .post(`/api/users/${bob.user.nickname}/block`)
      .set('Cookie', alice.cookie);

    const res = await request(app)
      .get(`/api/users/${bob.user.nickname}`)
      .set('Cookie', alice.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.te_bloqueo).toBe(true);
    expect(res.body.data.categories).toEqual([]);
  });

  test('desbloquear restaura interacción', async () => {
    await request(app)
      .post(`/api/users/${bob.user.nickname}/block`)
      .set('Cookie', alice.cookie);

    // desbloquear
    const res = await request(app)
      .delete(`/api/users/${bob.user.nickname}/block`)
      .set('Cookie', alice.cookie);
    expect(res.status).toBe(200);

    // puede seguir de nuevo
    const followRes = await request(app)
      .post(`/api/users/${bob.user.nickname}/follow`)
      .set('Cookie', alice.cookie);
    expect(followRes.status).toBe(200);
  });

  test('listar usuarios bloqueados', async () => {
    await request(app)
      .post(`/api/users/${bob.user.nickname}/block`)
      .set('Cookie', alice.cookie);

    const res = await request(app)
      .get('/api/users/blocked')
      .set('Cookie', alice.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].nickname).toBe('bob');
  });

  test('bloqueo recíproco funciona', async () => {
    // alice bloquea a bob
    await request(app)
      .post(`/api/users/${bob.user.nickname}/block`)
      .set('Cookie', alice.cookie);

    // bob bloquea a alice
    await request(app)
      .post(`/api/users/${alice.user.nickname}/block`)
      .set('Cookie', bob.cookie);

    // ambos ven sus bloqueados
    let res = await request(app).get('/api/users/blocked').set('Cookie', alice.cookie);
    expect(res.body.data).toHaveLength(1);

    res = await request(app).get('/api/users/blocked').set('Cookie', bob.cookie);
    expect(res.body.data).toHaveLength(1);

    // alice desbloquea, pero bob sigue bloqueando a alice
    await request(app)
      .delete(`/api/users/${bob.user.nickname}/block`)
      .set('Cookie', alice.cookie);

    // alice no puede seguir a bob (bob la tiene bloqueada)
    const followRes = await request(app)
      .post(`/api/users/${bob.user.nickname}/follow`)
      .set('Cookie', alice.cookie);
    expect(followRes.status).toBe(403);
  });
});
