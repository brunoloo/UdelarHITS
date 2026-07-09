import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createCategory, createTopic } from '../helpers.js';

// Feed del Home (/api/categories/feed): personalizado con sesión + señales,
// cronológico (como Recientes) para invitados y cold start. Paginado por cursor.

async function fetchFeed({ cookie = null, limit = 20, cursor = null } = {}) {
  let url = `/api/categories/feed?limit=${limit}`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  const req = request(app).get(url);
  if (cookie) req.set('Cookie', cookie);
  const res = await req;
  expect(res.status).toBe(200);
  expect(res.body.ok).toBe(true);
  return res.body;
}

// Agota todas las páginas y devuelve los ids en orden.
async function fetchAllFeedIds(opts = {}) {
  const ids = [];
  let cursor = null;
  for (let page = 0; page < 20; page++) {
    const body = await fetchFeed({ ...opts, cursor });
    ids.push(...body.data.map(c => c.id));
    cursor = body.nextCursor;
    if (!cursor) return ids;
  }
  throw new Error('fetchAllFeedIds: demasiadas páginas (¿cursor en loop?)');
}

// Dos etiquetas distintas cualesquiera del seed, como arrays de ids.
async function getTwoTagIds() {
  const { rows } = await pool.query('SELECT id FROM etiqueta ORDER BY id LIMIT 2');
  expect(rows.length).toBe(2);
  return [[Number(rows[0].id)], [Number(rows[1].id)]];
}

describe('GET /api/categories/feed — invitado y cold start', () => {
  test('invitado: orden cronológico (igual que Recientes)', async () => {
    const autor = await registerAndLogin();
    const cat1 = await createCategory(autor.cookie);
    const cat2 = await createCategory(autor.cookie);
    const cat3 = await createCategory(autor.cookie);

    const body = await fetchFeed();
    expect(body.data.map(c => c.id)).toEqual([cat3.id, cat2.id, cat1.id]);
    expect(body.nextCursor).toBeNull();
  });

  test('cold start: usuario sin señales ve el fallback cronológico', async () => {
    const autor = await registerAndLogin();
    const cat1 = await createCategory(autor.cookie);
    const cat2 = await createCategory(autor.cookie);

    // Usuario nuevo: sin participación, sin suscripciones, sin likes.
    const nuevo = await registerAndLogin();
    const body = await fetchFeed({ cookie: nuevo.cookie });
    expect(body.data.map(c => c.id)).toEqual([cat2.id, cat1.id]);
  });

  test('cursor malformado responde 400', async () => {
    const res = await request(app).get('/api/categories/feed?cursor=nocursor%3D%3D');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/categories/feed — personalizado', () => {
  test('mis categorías (participación) van primero', async () => {
    const otro = await registerAndLogin();
    await createCategory(otro.cookie);
    await createCategory(otro.cookie);

    const yo = await registerAndLogin();
    const mia = await createCategory(yo.cookie); // creador = moderador = participación

    // Una ajena creada DESPUÉS de la mía: sin personalización ganaría por
    // novedad/id, así que si 'mia' encabeza es por la participación.
    const posterior = await createCategory(otro.cookie);

    const body = await fetchFeed({ cookie: yo.cookie });
    const ids = body.data.map(c => c.id);
    expect(ids[0]).toBe(mia.id);
    expect(ids).toContain(posterior.id);
  });

  test('categoría suscripta va priorizada', async () => {
    const otro = await registerAndLogin();
    const c1 = await createCategory(otro.cookie);
    const c2 = await createCategory(otro.cookie);
    const c3 = await createCategory(otro.cookie);

    const yo = await registerAndLogin();
    const sub = await request(app)
      .post(`/api/categories/${c1.id}/subscribe`)
      .set('Cookie', yo.cookie);
    expect(sub.status).toBeLessThan(400);

    const body = await fetchFeed({ cookie: yo.cookie });
    const ids = body.data.map(c => c.id);
    // c1 (suscripta) por delante de c2 y c3 aunque sea la más vieja
    expect(ids[0]).toBe(c1.id);
    expect(ids.indexOf(c1.id)).toBeLessThan(ids.indexOf(c3.id));
    expect(ids.indexOf(c1.id)).toBeLessThan(ids.indexOf(c2.id));
  });

  test('afinidad por etiquetas: likear contenido de una etiqueta prioriza categorías con esa etiqueta', async () => {
    const [tagX, tagY] = await getTwoTagIds();

    const otro = await registerAndLogin();
    // catY se crea ÚLTIMA: sin afinidad le ganaría a catX2 por el desempate
    // de id (misma novedad, sin actividad). Si catX2 termina arriba, es por
    // la afinidad de etiquetas.
    const catX2 = await createCategory(otro.cookie, { etiquetas: tagX });
    const catX1 = await createCategory(otro.cookie, { etiquetas: tagX });
    const catY = await createCategory(otro.cookie, { etiquetas: tagY });

    // Un tema en catX1 para likear (el like del usuario apunta a ese contenido)
    const tema = await createTopic(otro.cookie, { categoria_id: catX1.id });

    const yo = await registerAndLogin();
    const like = await request(app)
      .post(`/api/reactions/${tema.id ?? tema.contenido_id}`)
      .set('Cookie', yo.cookie)
      .send({ tipo: 'meGusta' });
    expect(like.status).toBeLessThan(400);

    const ids = await fetchAllFeedIds({ cookie: yo.cookie });
    // catX2 comparte etiqueta con mi historial de likes → por encima de catY,
    // que sin afinidad me ganaría por ser más nueva.
    expect(ids.indexOf(catX2.id)).toBeLessThan(ids.indexOf(catY.id));
  });
});

describe('GET /api/categories/feed — paginación por cursor', () => {
  test('cronológico: página 2 no repite ni saltea, y coincide con el fetch entero', async () => {
    const autor = await registerAndLogin();
    const creadas = [];
    for (let i = 0; i < 25; i++) creadas.push(await createCategory(autor.cookie));

    const p1 = await fetchFeed({ limit: 10 });
    expect(p1.data.length).toBe(10);
    expect(p1.nextCursor).toBeTruthy();

    const p2 = await fetchFeed({ limit: 10, cursor: p1.nextCursor });
    expect(p2.data.length).toBe(10);

    const p3 = await fetchFeed({ limit: 10, cursor: p2.nextCursor });
    expect(p3.data.length).toBe(5);
    expect(p3.nextCursor).toBeNull();

    const paginado = [...p1.data, ...p2.data, ...p3.data].map(c => c.id);
    expect(new Set(paginado).size).toBe(25); // sin repetidos

    const entero = await fetchFeed({ limit: 50 });
    expect(paginado).toEqual(entero.data.map(c => c.id)); // sin salteos ni desorden
  });

  test('personalizado con empates de puntaje: sin repetidos ni salteos entre páginas', async () => {
    const autor = await registerAndLogin();
    const creadas = [];
    for (let i = 0; i < 15; i++) creadas.push(await createCategory(autor.cookie));

    // Usuario con una sola señal: suscripto a una categoría del medio.
    // El resto empata en puntaje (misma novedad, sin actividad) → el cursor
    // tiene que desempatar por id sin duplicar ni perder filas.
    const yo = await registerAndLogin();
    await request(app)
      .post(`/api/categories/${creadas[7].id}/subscribe`)
      .set('Cookie', yo.cookie);

    const p1 = await fetchFeed({ cookie: yo.cookie, limit: 6 });
    const p2 = await fetchFeed({ cookie: yo.cookie, limit: 6, cursor: p1.nextCursor });
    const p3 = await fetchFeed({ cookie: yo.cookie, limit: 6, cursor: p2.nextCursor });

    const paginado = [...p1.data, ...p2.data, ...p3.data].map(c => c.id);
    expect(paginado.length).toBe(15);
    expect(new Set(paginado).size).toBe(15);
    expect(paginado[0]).toBe(creadas[7].id); // la suscripta encabeza

    const entero = await fetchFeed({ cookie: yo.cookie, limit: 50 });
    expect(paginado).toEqual(entero.data.map(c => c.id));
  });

  test('cursor de otro modo (login/logout a mitad de scroll) responde 400', async () => {
    const autor = await registerAndLogin();
    for (let i = 0; i < 3; i++) await createCategory(autor.cookie);

    const p1 = await fetchFeed({ limit: 2 }); // cursor de modo cronológico
    const res = await request(app)
      .get(`/api/categories/feed?limit=2&cursor=${encodeURIComponent(p1.nextCursor)}`)
      .set('Cookie', autor.cookie); // autor tiene señales → modo personalizado
    expect(res.status).toBe(400);
  });
});
