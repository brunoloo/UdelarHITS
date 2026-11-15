import request from 'supertest';
import app from '../../src/app.js';
import {
  registerAndLogin, createTopic, createCategory, createReply, createHomeReply,
} from '../helpers.js';

const idOf = (x) => x.id ?? x.contenido_id;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const recent = (qs = '') => request(app).get(`/api/replies/recent${qs}`);

describe('GET /replies/recent', () => {
  test('es público (sin sesión) → 200 y array', async () => {
    const res = await recent();
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('incluye comentarios de Home, de categoría y de tema', async () => {
    const u = await registerAndLogin();
    const cat = await createCategory(u.cookie);
    const topic = await createTopic(u.cookie, { categoria_id: cat.id });

    const home = await createHomeReply(u.cookie, { cuerpo: 'comentario de home' });
    const enCat = await createReply(u.cookie, { categoria_id: cat.id, cuerpo: 'comentario de categoria' });
    const enTema = await createReply(u.cookie, { tema_id: idOf(topic), cuerpo: 'comentario de tema' });

    const res = await recent('?limit=50');
    const ids = res.body.data.map(idOf);
    expect(ids).toContain(idOf(home));
    expect(ids).toContain(idOf(enCat));
    expect(ids).toContain(idOf(enTema));

    // Cada uno trae su `tipo` para que CommentEntry arme el deep-link correcto.
    const byId = (id) => res.body.data.find((c) => idOf(c) === id);
    expect(byId(idOf(home)).tipo).toBe('home');
    expect(byId(idOf(enCat)).tipo).toBe('categoria');
    expect(byId(idOf(enTema)).tipo).toBe('tema');
  });

  test('incluye respuestas anidadas (no solo primer nivel)', async () => {
    const u = await registerAndLogin();
    const topic = await createTopic(u.cookie);
    const padre = await createReply(u.cookie, { tema_id: idOf(topic), cuerpo: 'padre' });
    const hija = await createReply(u.cookie, {
      tema_id: idOf(topic),
      comentario_padre_id: idOf(padre),
      cuerpo: 'respuesta anidada',
    });

    const res = await recent('?limit=50');
    const ids = res.body.data.map(idOf);
    expect(ids).toContain(idOf(hija));
    const hijaRow = res.body.data.find((c) => idOf(c) === idOf(hija));
    expect(Number(hijaRow.comentario_padre_id)).toBe(Number(idOf(padre)));
  });

  test('ordena del más nuevo al más viejo', async () => {
    const u = await registerAndLogin();
    const topic = await createTopic(u.cookie);
    const c1 = await createReply(u.cookie, { tema_id: idOf(topic), cuerpo: 'primero' });
    await sleep(15);
    const c2 = await createReply(u.cookie, { tema_id: idOf(topic), cuerpo: 'segundo' });
    await sleep(15);
    const c3 = await createReply(u.cookie, { tema_id: idOf(topic), cuerpo: 'tercero' });

    const res = await recent('?limit=50');
    const ids = res.body.data.map(idOf);
    const pos = (c) => ids.indexOf(idOf(c));
    expect(pos(c3)).toBeLessThan(pos(c2));
    expect(pos(c2)).toBeLessThan(pos(c1));
  });

  test('un comentario en tema inactivo NO aparece', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const topic = await createTopic(a.cookie);
    const com = await createReply(b.cookie, { tema_id: idOf(topic) });
    // Borrar el tema lo deja inactivo (tiene comentarios) → su comentario no debe figurar.
    await request(app).delete(`/api/topics/${idOf(topic)}/delete`).set('Cookie', a.cookie);

    const res = await recent('?limit=50');
    const ids = res.body.data.map(idOf);
    expect(ids).not.toContain(idOf(com));
  });

  test('respeta el límite ?limit=', async () => {
    const u = await registerAndLogin();
    const topic = await createTopic(u.cookie);
    for (let i = 0; i < 5; i++) {
      await createReply(u.cookie, { tema_id: idOf(topic), cuerpo: `c${i}` });
    }
    const res = await recent('?limit=3');
    expect(res.body.data.length).toBeLessThanOrEqual(3);
  });
});

describe('GET /replies/recent?sin_respuesta=1', () => {
  test('solo trae comentarios de primer nivel que nadie respondió', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const respondido = await createHomeReply(a.cookie, { cuerpo: 'respondido' });
    const respuesta = await createReply(b.cookie, { comentario_padre_id: idOf(respondido) });
    const pendiente = await createHomeReply(a.cookie, { cuerpo: 'pendiente' });

    const ids = (await recent('?sin_respuesta=1')).body.data.map(idOf);
    expect(ids).toEqual([idOf(pendiente)]);
    expect(ids).not.toContain(idOf(respuesta));
  });

  test('incluye comentarios de categoría y de tema, no solo de Home', async () => {
    const u = await registerAndLogin();
    const cat = await createCategory(u.cookie);
    const enCat = await createReply(u.cookie, { categoria_id: cat.id });
    const enTema = await createReply(u.cookie);

    const ids = (await recent('?sin_respuesta=1')).body.data.map(idOf);
    expect(ids).toEqual(expect.arrayContaining([idOf(enCat), idOf(enTema)]));
  });

  test('con sesión no ofrece los comentarios propios', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const deA = await createHomeReply(a.cookie);
    const deB = await createHomeReply(b.cookie);

    const res = await recent('?sin_respuesta=1').set('Cookie', a.cookie);
    expect(res.body.data.map(idOf)).toEqual([idOf(deB)]);

    const invitado = await recent('?sin_respuesta=1');
    expect(invitado.body.data.map(idOf)).toEqual([idOf(deB), idOf(deA)]);
  });

  test('una respuesta oculta no cuenta: el comentario vuelve a estar pendiente', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const c = await registerAndLogin();
    const raiz = await createHomeReply(a.cookie);
    const resp = await createReply(b.cookie, { comentario_padre_id: idOf(raiz) });
    await createReply(c.cookie, { comentario_padre_id: idOf(resp) });
    // Con respuestas propias, el borrado deja la respuesta oculta.
    await request(app).delete(`/api/replies/delete/${idOf(resp)}`).set('Cookie', b.cookie);

    const ids = (await recent('?sin_respuesta=1')).body.data.map(idOf);
    expect(ids).toContain(idOf(raiz));
  });

  test('sin el parámetro el listado no cambia', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const raiz = await createHomeReply(a.cookie);
    const resp = await createReply(b.cookie, { comentario_padre_id: idOf(raiz) });

    const ids = (await recent()).body.data.map(idOf);
    expect(ids).toEqual(expect.arrayContaining([idOf(raiz), idOf(resp)]));
  });
});
