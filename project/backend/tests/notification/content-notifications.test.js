import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createCategory, createTopic, createReply } from '../helpers.js';

const getNotifs = (cookie) =>
  request(app).get('/api/notifications').set('Cookie', cookie).then(r => r.body.data);

// ─── #2: publicar un tema en una categoría ───
describe('Notificación: tema publicado en una categoría', () => {
  test('el autor de la categoría recibe la notificación con link al tema', async () => {
    const dueño = await registerAndLogin();
    const otro = await registerAndLogin();
    const cat = await createCategory(dueño.cookie);

    const topic = await createTopic(otro.cookie, { categoria_id: cat.id });

    const notif = (await getNotifs(dueño.cookie)).find(n => n.tipo === 'tema_en_categoria');
    expect(notif).toBeDefined();
    expect(notif.actor_nickname).toBe(otro.user.nickname);
    expect(notif.mensaje).toContain(cat.titulo);
    expect(notif.url).toBe(`/topic/${topic.contenido_id ?? topic.id}`);
  });

  test('crear un tema en tu propia categoría no genera notificación', async () => {
    const dueño = await registerAndLogin();
    const cat = await createCategory(dueño.cookie);
    await createTopic(dueño.cookie, { categoria_id: cat.id });

    const notifs = await getNotifs(dueño.cookie);
    expect(notifs.filter(n => n.tipo === 'tema_en_categoria')).toHaveLength(0);
  });
});

// ─── #3: comentar directamente en una categoría ───
describe('Notificación: comentario directo en una categoría', () => {
  test('el autor de la categoría recibe la notificación con link al comentario', async () => {
    const dueño = await registerAndLogin();
    const otro = await registerAndLogin();
    const cat = await createCategory(dueño.cookie);

    const comment = await createReply(otro.cookie, { categoria_id: cat.id });

    const notif = (await getNotifs(dueño.cookie)).find(n => n.tipo === 'comentario_en_categoria');
    expect(notif).toBeDefined();
    expect(notif.actor_nickname).toBe(otro.user.nickname);
    expect(notif.mensaje).toContain(cat.titulo);
    expect(notif.url).toBe(`/category/${cat.id}?tab=comentarios&commentId=${comment.contenido_id}`);
  });

  test('comentar tu propia categoría no genera notificación', async () => {
    const dueño = await registerAndLogin();
    const cat = await createCategory(dueño.cookie);
    await createReply(dueño.cookie, { categoria_id: cat.id });

    const notifs = await getNotifs(dueño.cookie);
    expect(notifs.filter(n => n.tipo === 'comentario_en_categoria')).toHaveLength(0);
  });

  test('la notificación marca tiene_encuesta cuando el comentario lleva encuesta', async () => {
    const dueño = await registerAndLogin();
    const otro = await registerAndLogin();
    const cat = await createCategory(dueño.cookie);

    await request(app).post('/api/replies/create').set('Cookie', otro.cookie)
      .field('categoria_id', String(cat.id))
      .field('encuesta', JSON.stringify({ opciones: ['A', 'B'], duracion_segundos: 3600 }));

    const notif = (await getNotifs(dueño.cookie)).find(n => n.tipo === 'comentario_en_categoria');
    expect(notif).toBeDefined();
    expect(notif.tiene_encuesta).toBe(true);
    expect(notif.tiene_imagen).toBe(false);
  });
});

// ─── #4: comentar en un tema (doble notificación) ───
describe('Notificación: comentario en un tema de una categoría', () => {
  test('dispara notificación al autor del tema y al autor de la categoría', async () => {
    const dueñoCat = await registerAndLogin();
    const dueñoTema = await registerAndLogin();
    const comentarista = await registerAndLogin();

    const cat = await createCategory(dueñoCat.cookie);
    const topic = await createTopic(dueñoTema.cookie, { categoria_id: cat.id });
    const temaId = topic.contenido_id ?? topic.id;
    const comment = await createReply(comentarista.cookie, { tema_id: temaId });
    const urlEsperada = `/topic/${temaId}?commentId=${comment.contenido_id}`;

    // Autor del tema: "comentó en tu <titulo>"
    const notifTema = (await getNotifs(dueñoTema.cookie)).find(n => n.tipo === 'comentario_en_tema');
    expect(notifTema).toBeDefined();
    expect(notifTema.actor_nickname).toBe(comentarista.user.nickname);
    expect(notifTema.url).toBe(urlEsperada);

    // Autor de la categoría: "comentó en un tema de tu categoría <titulo>"
    const notifCat = (await getNotifs(dueñoCat.cookie)).find(n => n.tipo === 'comentario_en_tema_categoria');
    expect(notifCat).toBeDefined();
    expect(notifCat.actor_nickname).toBe(comentarista.user.nickname);
    expect(notifCat.mensaje).toContain(cat.titulo);
    expect(notifCat.url).toBe(urlEsperada);
  });

  test('si el autor del tema y de la categoría son la misma persona, recibe una sola notificación', async () => {
    const dueño = await registerAndLogin();          // crea categoría y tema
    const comentarista = await registerAndLogin();

    const cat = await createCategory(dueño.cookie);
    const topic = await createTopic(dueño.cookie, { categoria_id: cat.id });
    const temaId = topic.contenido_id ?? topic.id;
    await createReply(comentarista.cookie, { tema_id: temaId });

    const notifs = await getNotifs(dueño.cookie);
    expect(notifs.filter(n => n.tipo === 'comentario_en_tema')).toHaveLength(1);
    expect(notifs.filter(n => n.tipo === 'comentario_en_tema_categoria')).toHaveLength(0);
  });

  test('comentar tu propio tema no genera notificación para vos', async () => {
    const dueñoCat = await registerAndLogin();
    const dueñoTema = await registerAndLogin();

    const cat = await createCategory(dueñoCat.cookie);
    const topic = await createTopic(dueñoTema.cookie, { categoria_id: cat.id });
    const temaId = topic.contenido_id ?? topic.id;
    await createReply(dueñoTema.cookie, { tema_id: temaId });

    // El autor del tema no se autonotifica...
    const propias = await getNotifs(dueñoTema.cookie);
    expect(propias.filter(n => n.tipo === 'comentario_en_tema')).toHaveLength(0);
    // ...pero el autor de la categoría sí recibe la suya.
    const cat_notifs = await getNotifs(dueñoCat.cookie);
    expect(cat_notifs.filter(n => n.tipo === 'comentario_en_tema_categoria')).toHaveLength(1);
  });

  test('responder a un comentario (anidado) no dispara las notificaciones de primer nivel', async () => {
    const dueñoCat = await registerAndLogin();
    const dueñoTema = await registerAndLogin();
    const comentarista = await registerAndLogin();

    const cat = await createCategory(dueñoCat.cookie);
    const topic = await createTopic(dueñoTema.cookie, { categoria_id: cat.id });
    const temaId = topic.contenido_id ?? topic.id;
    const comment = await createReply(comentarista.cookie, { tema_id: temaId });

    // Limpiar el estado: contar notificaciones de tipo nivel-1 antes de la respuesta anidada.
    const beforeCat = (await getNotifs(dueñoCat.cookie)).filter(n => n.tipo === 'comentario_en_tema_categoria').length;
    const beforeTema = (await getNotifs(dueñoTema.cookie)).filter(n => n.tipo === 'comentario_en_tema').length;

    // Respuesta anidada (comentario_padre_id) → solo 'respuesta_comentario', no las de nivel 1.
    await createReply(dueñoTema.cookie, { comentario_padre_id: comment.contenido_id });

    const afterCat = (await getNotifs(dueñoCat.cookie)).filter(n => n.tipo === 'comentario_en_tema_categoria').length;
    const afterTema = (await getNotifs(dueñoTema.cookie)).filter(n => n.tipo === 'comentario_en_tema').length;
    expect(afterCat).toBe(beforeCat);
    expect(afterTema).toBe(beforeTema);
  });
});
