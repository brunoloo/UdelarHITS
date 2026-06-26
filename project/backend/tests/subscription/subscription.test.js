import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createCategory, createTopic, createReply } from '../helpers.js';

const topicId = (t) => t.id ?? t.contenido_id;
const subscribe = (cookie, id) => request(app).post(`/api/categories/${id}/subscribe`).set('Cookie', cookie);
const unsubscribe = (cookie, id) => request(app).delete(`/api/categories/${id}/subscribe`).set('Cookie', cookie);
const subState = (cookie, id) => request(app).get(`/api/categories/${id}/subscription`).set('Cookie', cookie).then(r => r.body.data.suscrito);
const getNotifs = (cookie) => request(app).get('/api/notifications').set('Cookie', cookie).then(r => r.body.data);

describe('Suscripción a categoría (campanita)', () => {
  test('suscribirse/desuscribirse refleja el estado', async () => {
    const mod = await registerAndLogin();
    const visitor = await registerAndLogin();
    const cat = await createCategory(mod.cookie);

    expect(await subState(visitor.cookie, cat.id)).toBe(false);
    expect((await subscribe(visitor.cookie, cat.id)).status).toBe(200);
    expect(await subState(visitor.cookie, cat.id)).toBe(true);
    expect((await unsubscribe(visitor.cookie, cat.id)).status).toBe(200);
    expect(await subState(visitor.cookie, cat.id)).toBe(false);
  });

  test('al crear un tema, el suscriptor recibe notificación con el título', async () => {
    const mod = await registerAndLogin();
    const visitor = await registerAndLogin();
    const autor = await registerAndLogin();
    const cat = await createCategory(mod.cookie);
    await subscribe(visitor.cookie, cat.id);

    const topic = await createTopic(autor.cookie, { categoria_id: cat.id, titulo: 'Tema nuevo de prueba' });

    const notifs = await getNotifs(visitor.cookie);
    const n = notifs.find(x => x.tipo === 'tema_categoria_seguida');
    expect(n).toBeDefined();
    expect(n.url).toBe(`/topic/${topicId(topic)}`);
    expect(n.mensaje).toContain('creó un tema en');
    expect(n.contenido_preview).toBe('Tema nuevo de prueba');
  });

  test('al publicar un comentario directo, el suscriptor recibe notificación con el comentario', async () => {
    const mod = await registerAndLogin();
    const visitor = await registerAndLogin();
    const autor = await registerAndLogin();
    const cat = await createCategory(mod.cookie);
    await subscribe(visitor.cookie, cat.id);

    const c = await createReply(autor.cookie, { categoria_id: cat.id, cuerpo: 'comentario directo a la categoría' });

    const notifs = await getNotifs(visitor.cookie);
    const n = notifs.find(x => x.tipo === 'comentario_categoria_seguida');
    expect(n).toBeDefined();
    expect(n.mensaje).toContain('publicó un comentario en');
    expect(n.contenido_preview).toContain('comentario directo');
    expect(n.url).toContain(`commentId=${c.contenido_id}`);
  });

  test('NO notifica por comentarios dentro de un tema ni por respuestas', async () => {
    const mod = await registerAndLogin();
    const visitor = await registerAndLogin();
    const autor = await registerAndLogin();
    const cat = await createCategory(mod.cookie);
    await subscribe(visitor.cookie, cat.id);

    const topic = await createTopic(autor.cookie, { categoria_id: cat.id });
    await createReply(autor.cookie, { tema_id: topicId(topic), cuerpo: 'comentario en el tema' });
    const c1 = await createReply(autor.cookie, { categoria_id: cat.id, cuerpo: 'directo primer nivel' });
    await createReply(autor.cookie, { comentario_padre_id: c1.contenido_id, cuerpo: 'una respuesta' });

    const notifs = await getNotifs(visitor.cookie);
    // Solo el comentario directo de primer nivel genera la notificación.
    expect(notifs.filter(n => n.tipo === 'comentario_categoria_seguida')).toHaveLength(1);
  });

  test('no se notifica al actor ni se suscribe sin sesión', async () => {
    const mod = await registerAndLogin();
    const visitor = await registerAndLogin();
    const cat = await createCategory(mod.cookie);
    await subscribe(visitor.cookie, cat.id);

    // El propio suscriptor crea un tema → no se notifica a sí mismo.
    await createTopic(visitor.cookie, { categoria_id: cat.id, titulo: 'Mi propio tema' });
    const notifs = await getNotifs(visitor.cookie);
    expect(notifs.find(n => n.tipo === 'tema_categoria_seguida')).toBeUndefined();

    // Sin sesión → 401.
    expect((await request(app).post(`/api/categories/${cat.id}/subscribe`)).status).toBe(401);
  });
});
