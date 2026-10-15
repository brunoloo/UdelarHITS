import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createCategory, createTopic } from '../helpers.js';
import {
  _setFeedIntensityOverride, _setFeedSeedOverride, _resetFeedRanking,
} from '../../src/services/feedRanking.service.js';

// Feed del Home (/api/categories/feed): rankeado para logueados (rotación por
// visita, afinidad acotada, cupo de exploración), cronológico (como Recientes)
// para invitados. Paginado por cursor.

beforeEach(() => {
  _setFeedSeedOverride(12345);
  _setFeedIntensityOverride(1);
});
afterEach(() => _resetFeedRanking());

async function fetchFeed({ cookie = null, limit = 20, cursor = null, visita = null } = {}) {
  let url = `/api/categories/feed?limit=${limit}`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  if (visita) url += `&visita=${encodeURIComponent(visita)}`;
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

const like = async (cookie, contenidoId) => {
  const r = await request(app).post(`/api/reactions/${contenidoId}`)
    .set('Cookie', cookie).send({ tipo: 'meGusta' });
  expect(r.status).toBeLessThan(400);
};

// Dos etiquetas distintas cualesquiera del seed, como arrays de ids.
async function getTwoTagIds() {
  const { rows } = await pool.query('SELECT id FROM etiqueta ORDER BY id LIMIT 2');
  expect(rows.length).toBe(2);
  return [[Number(rows[0].id)], [Number(rows[1].id)]];
}

const encode = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

describe('GET /api/categories/feed — invitado y logueado sin señales', () => {
  test('invitado: orden cronológico (igual que Recientes)', async () => {
    const autor = await registerAndLogin();
    const cat1 = await createCategory(autor.cookie);
    const cat2 = await createCategory(autor.cookie);
    const cat3 = await createCategory(autor.cookie);

    const body = await fetchFeed();
    expect(body.data.map(c => c.id)).toEqual([cat3.id, cat2.id, cat1.id]);
    expect(body.nextCursor).toBeNull();
    expect(body.visita).toBeUndefined();
  });

  test('logueado sin señales recibe todas las categorías sin repetidos (rankeado)', async () => {
    const autor = await registerAndLogin();
    const creadas = [];
    for (let i = 0; i < 4; i++) creadas.push(await createCategory(autor.cookie));

    const nuevo = await registerAndLogin();
    const body = await fetchFeed({ cookie: nuevo.cookie });
    const ids = body.data.map(c => c.id);
    expect(ids).toHaveLength(4);
    expect(new Set(ids)).toEqual(new Set(creadas.map(c => c.id)));
    expect(typeof body.visita).toBe('string');
  });

  test('cursor malformado responde 400', async () => {
    const res = await request(app).get('/api/categories/feed?cursor=nocursor%3D%3D');
    expect(res.status).toBe(400);
  });
});

describe('GET /api/categories/feed — rankeado (w=1)', () => {
  test('mis categorías (participación) van primero', async () => {
    const otro = await registerAndLogin();
    await createCategory(otro.cookie);
    await createCategory(otro.cookie);

    const yo = await registerAndLogin();
    const mia = await createCategory(yo.cookie); // creador = moderador = participación

    // Una ajena creada DESPUÉS de la mía: misma edad práctica (segundos), así
    // que si 'mia' encabeza es por la afinidad, que supera al jitter máximo.
    const posterior = await createCategory(otro.cookie);

    const body = await fetchFeed({ cookie: yo.cookie });
    const ids = body.data.filter(c => c.tipo === 'categoria').map(c => c.id);
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
    expect(ids[0]).toBe(c1.id);
    expect(ids.indexOf(c1.id)).toBeLessThan(ids.indexOf(c3.id));
    expect(ids.indexOf(c1.id)).toBeLessThan(ids.indexOf(c2.id));
  });

  test('afinidad por etiquetas: likes en una etiqueta priorizan categorías con esa etiqueta', async () => {
    const [tagX, tagY] = await getTwoTagIds();

    const otro = await registerAndLogin();
    const catX2 = await createCategory(otro.cookie, { etiquetas: tagX });
    const catX1 = await createCategory(otro.cookie, { etiquetas: tagX });
    const catY = await createCategory(otro.cookie, { etiquetas: tagY });

    // 10 likes en contenido de tagX: satura el componente de etiquetas (tag=1),
    // que supera al jitter máximo → independiente de la semilla.
    const yo = await registerAndLogin();
    for (let i = 0; i < 10; i++) {
      const tema = await createTopic(otro.cookie, { categoria_id: catX1.id });
      await like(yo.cookie, tema.id ?? tema.contenido_id);
    }

    const ids = await fetchAllFeedIds({ cookie: yo.cookie });
    expect(ids.indexOf(catX2.id)).toBeLessThan(ids.indexOf(catY.id));
  });
});

describe('GET /api/categories/feed — paginación por cursor', () => {
  test('cronológico (invitado): página 2 no repite ni saltea, y coincide con el fetch entero', async () => {
    const autor = await registerAndLogin();
    for (let i = 0; i < 25; i++) await createCategory(autor.cookie);

    const p1 = await fetchFeed({ limit: 10 });
    expect(p1.data.length).toBe(10);
    expect(p1.nextCursor).toBeTruthy();

    const p2 = await fetchFeed({ limit: 10, cursor: p1.nextCursor });
    expect(p2.data.length).toBe(10);

    const p3 = await fetchFeed({ limit: 10, cursor: p2.nextCursor });
    expect(p3.data.length).toBe(5);
    expect(p3.nextCursor).toBeNull();

    const paginado = [...p1.data, ...p2.data, ...p3.data].map(c => c.id);
    expect(new Set(paginado).size).toBe(25);

    const entero = await fetchFeed({ limit: 50 });
    expect(paginado).toEqual(entero.data.map(c => c.id));
  });

  test('rankeado con semilla fija: sin repetidos ni salteos entre páginas', async () => {
    const autor = await registerAndLogin();
    const creadas = [];
    for (let i = 0; i < 15; i++) creadas.push(await createCategory(autor.cookie));

    const yo = await registerAndLogin();
    await request(app)
      .post(`/api/categories/${creadas[7].id}/subscribe`)
      .set('Cookie', yo.cookie);

    const p1 = await fetchFeed({ cookie: yo.cookie, limit: 6 });
    const p2 = await fetchFeed({ cookie: yo.cookie, limit: 6, cursor: p1.nextCursor });
    const p3 = await fetchFeed({ cookie: yo.cookie, limit: 6, cursor: p2.nextCursor });
    expect(p3.nextCursor).toBeNull();

    const paginado = [...p1.data, ...p2.data, ...p3.data].map(c => c.id);
    expect(paginado.length).toBe(15);
    expect(new Set(paginado).size).toBe(15);
    expect(paginado[0]).toBe(creadas[7].id); // la suscripta encabeza

    // Misma visita (t0/seed/w) en un solo fetch → mismo orden.
    const entero = await fetchFeed({ cookie: yo.cookie, limit: 50, visita: p1.visita });
    expect(paginado).toEqual(entero.data.map(c => c.id));
  });

  test('cursor de invitado (v2) con sesión responde 400', async () => {
    const autor = await registerAndLogin();
    for (let i = 0; i < 3; i++) await createCategory(autor.cookie);

    const p1 = await fetchFeed({ limit: 2 }); // invitado → cursor v2 'c'
    const res = await request(app)
      .get(`/api/categories/feed?limit=2&cursor=${encodeURIComponent(p1.nextCursor)}`)
      .set('Cookie', autor.cookie);
    expect(res.status).toBe(400);
  });

  test('cursor de logueado (v3) sin sesión responde 400', async () => {
    const autor = await registerAndLogin();
    for (let i = 0; i < 3; i++) await createCategory(autor.cookie);

    const p1 = await fetchFeed({ cookie: autor.cookie, limit: 2 });
    expect(p1.nextCursor).toBeTruthy();
    const res = await request(app)
      .get(`/api/categories/feed?limit=2&cursor=${encodeURIComponent(p1.nextCursor)}`);
    expect(res.status).toBe(400);
  });

  test("cursor v2 'p' (personalizado anterior al deploy) responde 400", async () => {
    const autor = await registerAndLogin();
    await createCategory(autor.cookie);
    const viejo = encode({ v: 2, m: 'p', cat: { s: '500', id: '1' }, com: null, slot: 0 });
    const res = await request(app)
      .get(`/api/categories/feed?cursor=${encodeURIComponent(viejo)}`)
      .set('Cookie', autor.cookie);
    expect(res.status).toBe(400);
  });

  test('cursor v2 de invitado con id fuera del rango de bigint responde 400', async () => {
    const enorme = encode({ v: 2, m: 'c', cat: { f: new Date().toISOString(), id: '99999999999999999999999' }, com: null, slot: 0 });
    const res = await request(app).get(`/api/categories/feed?cursor=${encodeURIComponent(enorme)}`);
    expect(res.status).toBe(400);
  });

  test('cursor v3 en el borde del rango de bigint se acepta (200)', async () => {
    const autor = await registerAndLogin();
    await createCategory(autor.cookie);
    const now = Math.floor(Date.now() / 1000);
    const borde = encode({ v: 3, m: 'r', t0: now, seed: 1, w: 1, slot: 0,
      cat: { k: 0, a: { s: '9223372036854775807', id: '9223372036854775807' }, e: { s: '-9223372036854775808', id: '1' } }, com: null });
    const res = await request(app)
      .get(`/api/categories/feed?cursor=${encodeURIComponent(borde)}`)
      .set('Cookie', autor.cookie);
    expect(res.status).toBe(200);
  });

  test('cursor v3 con campos inválidos responde 400', async () => {
    const autor = await registerAndLogin();
    const now = Math.floor(Date.now() / 1000);
    const malos = [
      { v: 3, m: 'r', t0: now + 3600, seed: 1, w: 1, slot: 0, cat: { k: 0, a: {}, e: {} }, com: null }, // t0 futuro
      { v: 3, m: 'r', t0: now, seed: 1, w: 1, slot: 0, cat: { k: -1, a: {}, e: {} }, com: null },      // k negativo
      { v: 3, m: 'r', t0: now, seed: 1, w: 1, slot: 0, cat: { k: 0, a: { s: '1x', id: '2' }, e: {} }, com: null },
      { v: 3, m: 'r', t0: now, seed: 1, w: 2, slot: 0, cat: null, com: null },                          // w fuera de rango
      // s / id fuera del rango de bigint (el cast en Postgres daría 500)
      { v: 3, m: 'r', t0: now, seed: 1, w: 1, slot: 0, cat: { k: 0, a: { s: '99999999999999999999999', id: '1' }, e: {} }, com: null },
      { v: 3, m: 'r', t0: now, seed: 1, w: 1, slot: 0, cat: { k: 0, a: { s: '-9223372036854775809', id: '1' }, e: {} }, com: null },
      { v: 3, m: 'r', t0: now, seed: 1, w: 1, slot: 0, cat: { k: 0, a: {}, e: { s: '1', id: '99999999999999999999999' } }, com: null },
      { v: 3, m: 'r', t0: now, seed: 1, w: 1, slot: 0, cat: null, com: { k: 0, a: { s: '1', id: '9223372036854775808' }, e: {} } },
    ];
    for (const c of malos) {
      const res = await request(app)
        .get(`/api/categories/feed?cursor=${encodeURIComponent(encode(c))}`)
        .set('Cookie', autor.cookie);
      expect(res.status).toBe(400);
    }
  });
});
