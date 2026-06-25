import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createCategory, createTopic, createReply } from '../helpers.js';

const topicId = (t) => t.id ?? t.contenido_id;

// Las tabs del perfil renderizan cards reducidas (categoría/tema) y la card
// completa de comentario. Estos tests fijan la forma de datos que el frontend
// necesita para cada una.
describe('Perfil — forma de datos del feed reducido', () => {
  test('GET /topics/user/:id incluye cuerpo y contador_comentarios', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const topic = await createTopic(a.cookie, { categoria_id: cat.id, cuerpo: 'cuerpo del tema X' });
    // Un comentario directo de primer nivel cuenta para contador_comentarios.
    await createReply(b.cookie, { tema_id: topicId(topic), cuerpo: 'comentario 1' });

    const res = await request(app).get(`/api/topics/user/${a.user.id}`).set('Cookie', a.cookie);
    expect(res.status).toBe(200);
    const t = res.body.data.find(x => Number(x.id) === Number(topicId(topic)));
    expect(t).toBeDefined();
    expect(t.cuerpo).toBe('cuerpo del tema X');
    expect(Number(t.contador_comentarios)).toBe(1);
    expect(t.categoria_titulo).toBe(cat.titulo);
    expect(Number(t.categoria_id)).toBe(Number(cat.id));
  });

  test('una respuesta anidada no suma a contador_comentarios del tema', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const topic = await createTopic(a.cookie);
    const directo = await createReply(b.cookie, { tema_id: topicId(topic), cuerpo: 'directo' });
    await createReply(b.cookie, { comentario_padre_id: directo.contenido_id, tema_id: topicId(topic), cuerpo: 'anidado' });

    const res = await request(app).get(`/api/topics/user/${a.user.id}`).set('Cookie', a.cookie);
    const t = res.body.data.find(x => Number(x.id) === Number(topicId(topic)));
    expect(Number(t.contador_comentarios)).toBe(1);
  });

  test('GET /replies/user/:id devuelve la forma completa de la CommentCard', async () => {
    const autor = await registerAndLogin();
    const liker = await registerAndLogin();
    const replier = await registerAndLogin();
    const topic = await createTopic(autor.cookie);
    const comment = await createReply(autor.cookie, { tema_id: topicId(topic), cuerpo: 'mi comentario' });

    await request(app).post(`/api/reactions/${comment.contenido_id}`).set('Cookie', liker.cookie).send({ tipo: 'meGusta' });
    await createReply(replier.cookie, { comentario_padre_id: comment.contenido_id, tema_id: topicId(topic), cuerpo: 'respuesta' });

    const res = await request(app).get(`/api/replies/user/${autor.user.id}`).set('Cookie', autor.cookie);
    expect(res.status).toBe(200);
    const r = res.body.data.find(x => Number(x.id) === Number(comment.contenido_id));
    expect(r).toBeDefined();
    expect(r.cuerpo).toBe('mi comentario');
    expect(r.tipo).toBe('tema');
    expect(Number(r.destino_id)).toBe(Number(topicId(topic)));
    expect(r.autor_nickname).toBe(autor.user.nickname);
    expect(r).toHaveProperty('autor_url_imagen');
    expect(r).toHaveProperty('autor_estado');
    expect(r).toHaveProperty('estado');
    expect(Number(r.likes)).toBe(1);
    expect(Number(r.contador_respuestas)).toBe(1);
  });

  test('mi_reaccion refleja la reacción del usuario que pide el feed', async () => {
    const autor = await registerAndLogin();
    const topic = await createTopic(autor.cookie);
    const comment = await createReply(autor.cookie, { tema_id: topicId(topic), cuerpo: 'con mi like' });
    await request(app).post(`/api/reactions/${comment.contenido_id}`).set('Cookie', autor.cookie).send({ tipo: 'meGusta' });

    const propio = await request(app).get(`/api/replies/user/${autor.user.id}`).set('Cookie', autor.cookie);
    const r1 = propio.body.data.find(x => Number(x.id) === Number(comment.contenido_id));
    expect(r1.mi_reaccion).toBe('meGusta');

    // Otro usuario viendo el mismo perfil no tiene reacción propia sobre ese comentario.
    const otro = await registerAndLogin();
    const ajeno = await request(app).get(`/api/replies/user/${autor.user.id}`).set('Cookie', otro.cookie);
    const r2 = ajeno.body.data.find(x => Number(x.id) === Number(comment.contenido_id));
    expect(r2.mi_reaccion).toBeNull();
  });

  test('comentario directo a categoría tiene tipo "categoria" y destino la categoría', async () => {
    const autor = await registerAndLogin();
    const cat = await createCategory(autor.cookie);
    const comment = await createReply(autor.cookie, { categoria_id: cat.id, cuerpo: 'comentario a categoria' });

    const res = await request(app).get(`/api/replies/user/${autor.user.id}`).set('Cookie', autor.cookie);
    const r = res.body.data.find(x => Number(x.id) === Number(comment.contenido_id));
    expect(r.tipo).toBe('categoria');
    expect(Number(r.destino_id)).toBe(Number(cat.id));
  });

  test('las categorías del perfil incluyen icono y descripcion para la card reducida', async () => {
    const a = await registerAndLogin();
    await createCategory(a.cookie, { descripcion: 'Una descripción visible en la card' });

    const res = await request(app).get(`/api/users/${encodeURIComponent(a.user.nickname)}`).set('Cookie', a.cookie);
    expect(res.status).toBe(200);
    const cats = res.body.data.categories;
    expect(cats.length).toBeGreaterThan(0);
    expect(cats[0]).toHaveProperty('descripcion');
    expect(cats[0]).toHaveProperty('icono');
    expect(cats[0]).toHaveProperty('etiquetas');
    expect(cats[0]).toHaveProperty('contador_temas');
  });
});
