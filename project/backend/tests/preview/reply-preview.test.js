import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createCategory, createTopic, createReply, createHomeReply } from '../helpers.js';

const idOf = (x) => Number(x.contenido_id ?? x.id);
const responder = (cookie, padreId, cuerpo = 'respuesta') =>
  createReply(cookie, { comentario_padre_id: padreId, cuerpo });
const like = (cookie, contenidoId) =>
  request(app).post(`/api/reactions/${contenidoId}`).set('Cookie', cookie).send({ tipo: 'meGusta' });

const homeFeed = async (cookie = null) => {
  const req = request(app).get('/api/categories/feed?limit=50');
  if (cookie) req.set('Cookie', cookie);
  const res = await req;
  return res.body.data.filter(i => i.tipo === 'comentario');
};
const previewDe = (lista, id) => lista.find(c => Number(c.id) === Number(id)).respuestas_preview;

describe('Vista previa de respuestas (respuestas_preview)', () => {
  test('un comentario sin respuestas trae la lista vacía', async () => {
    const a = await registerAndLogin();
    const raiz = await createHomeReply(a.cookie);

    expect(previewDe(await homeFeed(), idOf(raiz))).toEqual([]);
  });

  test('a igualdad de me gusta van primero las más antiguas, y son como máximo dos', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const raiz = await createHomeReply(a.cookie);
    const r1 = await responder(b.cookie, idOf(raiz), 'primera');
    const r2 = await responder(a.cookie, idOf(raiz), 'segunda');
    await responder(b.cookie, idOf(raiz), 'tercera');

    const preview = previewDe(await homeFeed(), idOf(raiz));
    expect(preview.map(p => Number(p.id))).toEqual([idOf(r1), idOf(r2)]);
    expect(preview[0]).toMatchObject({
      texto: 'primera', autor_nickname: b.user.nickname, likes: 0, mi_reaccion: null,
      tiene_imagen: false, tiene_adjunto: false, tiene_encuesta: false,
    });
  });

  test('las más votadas van primero y la respuesta trae mi reacción', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const c = await registerAndLogin();
    const raiz = await createHomeReply(a.cookie);
    const r1 = await responder(b.cookie, idOf(raiz), 'primera');
    await responder(b.cookie, idOf(raiz), 'segunda');
    const r3 = await responder(b.cookie, idOf(raiz), 'tercera');
    await like(a.cookie, idOf(r3));
    await like(c.cookie, idOf(r3));

    const preview = previewDe(await homeFeed(c.cookie), idOf(raiz));
    expect(preview.map(p => Number(p.id))).toEqual([idOf(r3), idOf(r1)]);
    expect(preview[0]).toMatchObject({ likes: 2, mi_reaccion: 'meGusta' });
  });

  test('solo cuenta respuestas directas: las respuestas a respuestas no aparecen', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const raiz = await createHomeReply(a.cookie);
    const r1 = await responder(b.cookie, idOf(raiz), 'directa');
    await responder(a.cookie, idOf(r1), 'anidada');

    const preview = previewDe(await homeFeed(), idOf(raiz));
    expect(preview.map(p => p.texto)).toEqual(['directa']);
  });

  test('una respuesta oculta no se elige: pasa a la siguiente', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const raiz = await createHomeReply(a.cookie);
    const oculta = await responder(b.cookie, idOf(raiz), 'se oculta');
    await responder(a.cookie, idOf(oculta), 'hija');
    await responder(a.cookie, idOf(raiz), 'visible');
    // Con respuestas propias, el borrado deja la respuesta oculta.
    await request(app).delete(`/api/replies/delete/${idOf(oculta)}`).set('Cookie', b.cookie);

    const preview = previewDe(await homeFeed(), idOf(raiz));
    expect(preview.map(p => p.texto)).toEqual(['visible']);
  });

  test('no muestra respuestas de un autor bloqueado por quien mira', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const c = await registerAndLogin();
    const raiz = await createHomeReply(a.cookie);
    await responder(b.cookie, idOf(raiz), 'de b');
    await responder(a.cookie, idOf(raiz), 'de a');
    await request(app).post(`/api/users/${b.user.nickname}/block`).set('Cookie', c.cookie);

    expect(previewDe(await homeFeed(c.cookie), idOf(raiz)).map(p => p.texto)).toEqual(['de a']);
    expect(previewDe(await homeFeed(), idOf(raiz)).map(p => p.texto)).toEqual(['de b', 'de a']);
  });

  test('el texto llega recortado y los adjuntos solo como marcadores', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const raiz = await createHomeReply(a.cookie);
    const larga = await responder(b.cookie, idOf(raiz), 'x'.repeat(1000));
    await pool.query(
      `INSERT INTO adjunto (contenido_id, url, public_id, nombre_original, tipo, tamano, estado)
       VALUES ($1, 'u1', 'p1', 'foto.png', 'imagen', 10, 'publicado'),
              ($1, 'u2', 'p2', 'apunte.pdf', 'documento', 10, 'publicado')`,
      [idOf(larga)]
    );

    const [p] = previewDe(await homeFeed(), idOf(raiz));
    expect(p.texto).toHaveLength(300);
    expect(p).toMatchObject({ tiene_imagen: true, tiene_adjunto: true });
    expect(p).not.toHaveProperty('adjuntos');
  });

  test('una imagen pendiente de revisión no se marca', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const raiz = await createHomeReply(a.cookie);
    const resp = await responder(b.cookie, idOf(raiz));
    await pool.query(
      `INSERT INTO adjunto (contenido_id, url, public_id, nombre_original, tipo, tamano, estado)
       VALUES ($1, 'u1', 'p1', 'foto.png', 'imagen', 10, 'pendiente_revision')`,
      [idOf(resp)]
    );

    const [p] = previewDe(await homeFeed(), idOf(raiz));
    expect(p.tiene_imagen).toBe(false);
  });

  test('un comentario oculto no trae vista previa aunque conserve respuestas', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const raiz = await createReply(a.cookie, { categoria_id: cat.id });
    await responder(b.cookie, idOf(raiz));
    await request(app).delete(`/api/replies/delete/${idOf(raiz)}`).set('Cookie', a.cookie);

    const res = await request(app).get(`/api/replies/category/${cat.id}`);
    const oculto = res.body.data.find(c => Number(c.id) === idOf(raiz));
    expect(oculto.estado).toBe('oculto');
    expect(oculto.respuestas_preview).toEqual([]);
  });

  test('también la traen los comentarios de categoría, de tema y las respuestas dentro de un hilo', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const tema = await createTopic(a.cookie, { categoria_id: cat.id });
    const temaId = tema.id ?? tema.contenido_id;

    const enCat = await createReply(a.cookie, { categoria_id: cat.id });
    const respCat = await responder(b.cookie, idOf(enCat), 'en categoría');
    await responder(a.cookie, idOf(respCat), 'nieta');
    const enTema = await createReply(a.cookie, { tema_id: temaId });
    await responder(b.cookie, idOf(enTema), 'en tema');

    const deCat = (await request(app).get(`/api/replies/category/${cat.id}`)).body.data;
    expect(previewDe(deCat, idOf(enCat)).map(p => p.texto)).toEqual(['en categoría']);

    const deTema = (await request(app).get(`/api/replies/topic/${temaId}`)).body.data;
    expect(previewDe(deTema, idOf(enTema)).map(p => p.texto)).toEqual(['en tema']);

    const hilo = (await request(app).get(`/api/replies/${idOf(enCat)}/replies`)).body.data;
    expect(previewDe(hilo, idOf(respCat)).map(p => p.texto)).toEqual(['nieta']);
  });

  test('el feed rankeado (con sesión) también la trae', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const raiz = await createHomeReply(a.cookie);
    await responder(b.cookie, idOf(raiz), 'hola');

    expect(previewDe(await homeFeed(b.cookie), idOf(raiz)).map(p => p.texto)).toEqual(['hola']);
  });
});
