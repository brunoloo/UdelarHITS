import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createCategory, createTopic, createReply } from '../helpers.js';

const topicId = (t) => t.id ?? t.contenido_id;
const like = (cookie, contenidoId) =>
  request(app).post(`/api/reactions/${contenidoId}`).set('Cookie', cookie).send({ tipo: 'meGusta' });

// Feature 11: tab "me gusta" — lista de comentarios likeados por el usuario.
// Feature 12: privacidad de me gusta (me_gusta_privado).
describe('Tab "me gusta" del perfil', () => {
  test('GET /replies/liked/:id devuelve los comentarios likeados con la forma de CommentCard', async () => {
    const autor = await registerAndLogin();
    const fan = await registerAndLogin();
    const topic = await createTopic(autor.cookie);
    const comment = await createReply(autor.cookie, { tema_id: topicId(topic), cuerpo: 'comentario likeado' });

    await like(fan.cookie, comment.contenido_id);

    const res = await request(app).get(`/api/replies/liked/${fan.user.id}`).set('Cookie', fan.cookie);
    expect(res.status).toBe(200);
    const r = res.body.data.find(x => Number(x.id) === Number(comment.contenido_id));
    expect(r).toBeDefined();
    expect(r.cuerpo).toBe('comentario likeado');
    expect(r.tipo).toBe('tema');
    expect(Number(r.destino_id)).toBe(Number(topicId(topic)));
    expect(r.autor_nickname).toBe(autor.user.nickname);
    expect(Number(r.likes)).toBe(1);
    expect(r).toHaveProperty('contador_respuestas');
    expect(r).toHaveProperty('estado');
    // El que pide es quien dio el like → mi_reaccion refleja su me gusta.
    expect(r.mi_reaccion).toBe('meGusta');
  });

  test('un like sobre un tema (no comentario) no aparece en la lista', async () => {
    const autor = await registerAndLogin();
    const fan = await registerAndLogin();
    const topic = await createTopic(autor.cookie);

    await like(fan.cookie, topicId(topic));

    const res = await request(app).get(`/api/replies/liked/${fan.user.id}`).set('Cookie', fan.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.find(x => Number(x.id) === Number(topicId(topic)))).toBeUndefined();
  });

  test('la lista solo incluye comentarios likeados (no los meramente creados)', async () => {
    const autor = await registerAndLogin();
    const topic = await createTopic(autor.cookie);
    // Comentario propio sin like → no debe aparecer.
    const sinLike = await createReply(autor.cookie, { tema_id: topicId(topic), cuerpo: 'sin like' });
    // Comentario que sí likea.
    const conLike = await createReply(autor.cookie, { tema_id: topicId(topic), cuerpo: 'con like' });
    await like(autor.cookie, conLike.contenido_id);

    const res = await request(app).get(`/api/replies/liked/${autor.user.id}`).set('Cookie', autor.cookie);
    const ids = res.body.data.map(x => Number(x.id));
    expect(ids).toContain(Number(conLike.contenido_id));
    expect(ids).not.toContain(Number(sinLike.contenido_id));
  });

  test('comentario directo a categoría likeado tiene tipo "categoria" y destino la categoría', async () => {
    const autor = await registerAndLogin();
    const fan = await registerAndLogin();
    const cat = await createCategory(autor.cookie);
    const comment = await createReply(autor.cookie, { categoria_id: cat.id, cuerpo: 'comentario en categoria' });
    await like(fan.cookie, comment.contenido_id);

    const res = await request(app).get(`/api/replies/liked/${fan.user.id}`).set('Cookie', fan.cookie);
    const r = res.body.data.find(x => Number(x.id) === Number(comment.contenido_id));
    expect(r.tipo).toBe('categoria');
    expect(Number(r.destino_id)).toBe(Number(cat.id));
  });
});

describe('Privacidad de me gusta', () => {
  test('el perfil expone me_gusta_privado (propio y de terceros)', async () => {
    const a = await registerAndLogin();

    const me = await request(app).get('/api/users/me').set('Cookie', a.cookie);
    expect(me.body.data.user).toHaveProperty('me_gusta_privado', false);

    const otro = await registerAndLogin();
    const perfil = await request(app).get(`/api/users/${encodeURIComponent(a.user.nickname)}`).set('Cookie', otro.cookie);
    expect(perfil.body.data.user).toHaveProperty('me_gusta_privado', false);
  });

  test('PATCH /me/likes-privacy alterna el valor', async () => {
    const a = await registerAndLogin();

    const on = await request(app).patch('/api/users/me/likes-privacy').set('Cookie', a.cookie);
    expect(on.status).toBe(200);
    expect(on.body.data.me_gusta_privado).toBe(true);

    const off = await request(app).patch('/api/users/me/likes-privacy').set('Cookie', a.cookie);
    expect(off.body.data.me_gusta_privado).toBe(false);
  });

  test('con me gusta privados, un tercero recibe 403 pero el dueño sigue viendo su lista', async () => {
    const dueno = await registerAndLogin();
    const fan = await registerAndLogin();
    const topic = await createTopic(fan.cookie);
    const comment = await createReply(fan.cookie, { tema_id: topicId(topic), cuerpo: 'algo' });
    await like(dueno.cookie, comment.contenido_id);

    // Activa privacidad de me gusta.
    await request(app).patch('/api/users/me/likes-privacy').set('Cookie', dueno.cookie);

    // Tercero: bloqueado.
    const ajeno = await request(app).get(`/api/replies/liked/${dueno.user.id}`).set('Cookie', fan.cookie);
    expect(ajeno.status).toBe(403);

    // Dueño: ve su propia lista.
    const propio = await request(app).get(`/api/replies/liked/${dueno.user.id}`).set('Cookie', dueno.cookie);
    expect(propio.status).toBe(200);
    expect(propio.body.data.find(x => Number(x.id) === Number(comment.contenido_id))).toBeDefined();
  });
});
