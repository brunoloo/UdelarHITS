import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createCategory, createTopic, createReply, createHomeReply } from '../helpers.js';

async function fetchFeed({ limit = 20, cursor = null } = {}) {
  let url = `/api/categories/feed?limit=${limit}`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const res = await request(app).get(url);
  expect(res.status).toBe(200);
  return res.body;
}

const idsDe = (body, tipo) => body.data.filter(i => i.tipo === tipo).map(i => Number(i.id));

describe('Feed Home de invitado — orden por última actividad', () => {
  test('una categoría con un comentario nuevo va antes que una creada después', async () => {
    const a = await registerAndLogin();
    const vieja = await createCategory(a.cookie);
    const nueva = await createCategory(a.cookie);
    await createReply(a.cookie, { categoria_id: vieja.id });

    const body = await fetchFeed();
    expect(idsDe(body, 'categoria')).toEqual([vieja.id, nueva.id].map(Number));
  });

  test('un tema nuevo o un comentario en un tema también cuentan como actividad', async () => {
    const a = await registerAndLogin();
    const conTema = await createCategory(a.cookie);
    const conComentarioEnTema = await createCategory(a.cookie);
    const vacia = await createCategory(a.cookie);

    const tema = await createTopic(a.cookie, { categoria_id: conComentarioEnTema.id });
    await createTopic(a.cookie, { categoria_id: conTema.id });
    await createReply(a.cookie, { tema_id: tema.id ?? tema.contenido_id });

    const body = await fetchFeed();
    expect(idsDe(body, 'categoria')).toEqual([conComentarioEnTema.id, conTema.id, vacia.id].map(Number));
  });

  test('un comentario de Home con una respuesta nueva vuelve arriba', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const viejo = await createHomeReply(a.cookie);
    const nuevo = await createHomeReply(a.cookie);
    await createReply(b.cookie, { comentario_padre_id: viejo.contenido_id });

    const body = await fetchFeed();
    expect(idsDe(body, 'comentario')).toEqual([Number(viejo.contenido_id), Number(nuevo.contenido_id)]);
  });

  test('un comentario oculto no cuenta como actividad', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const vieja = await createCategory(a.cookie);
    const nueva = await createCategory(a.cookie);
    const raiz = await createReply(b.cookie, { categoria_id: vieja.id });
    // Borrado sin respuestas: el comentario desaparece y la categoría vuelve a su lugar.
    await request(app).delete(`/api/replies/delete/${raiz.contenido_id}`).set('Cookie', b.cookie);

    const body = await fetchFeed();
    expect(idsDe(body, 'categoria')).toEqual([nueva.id, vieja.id].map(Number));
  });

  test('la paginación sigue el mismo orden y no repite ni saltea', async () => {
    const a = await registerAndLogin();
    const cats = [];
    for (let i = 0; i < 7; i++) cats.push(await createCategory(a.cookie));
    const coms = [];
    for (let i = 0; i < 5; i++) coms.push(await createHomeReply(a.cookie));
    // Actividad en orden inverso a la creación.
    for (const c of cats.slice(0, 3)) await createReply(a.cookie, { categoria_id: c.id });
    for (const c of coms.slice(0, 2)) await createReply(a.cookie, { comentario_padre_id: c.contenido_id });

    const entero = await fetchFeed({ limit: 50 });
    const paginado = [];
    let cursor = null;
    do {
      const page = await fetchFeed({ limit: 4, cursor });
      paginado.push(...page.data);
      cursor = page.nextCursor;
    } while (cursor);

    const clave = (i) => `${i.tipo}-${i.id}`;
    expect(paginado.map(clave)).toEqual(entero.data.map(clave));
    expect(new Set(paginado.map(clave)).size).toBe(12);
  });

  test('la card no expone el campo interno de orden', async () => {
    const a = await registerAndLogin();
    await createCategory(a.cookie);
    await createHomeReply(a.cookie);

    const body = await fetchFeed();
    expect(body.data).toHaveLength(2);
    for (const item of body.data) expect(item).not.toHaveProperty('ultima_actividad');
  });
});
