import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import {
  registerAndLogin, createAdmin, createCategory, createTopic, createReply, createHomeReply,
} from '../helpers.js';
import {
  computeIntensity, perfilDesdeIntensidad,
  _setFeedIntensityOverride, _setFeedSeedOverride, _resetFeedRanking,
} from '../../src/services/feedRanking.service.js';
import { mergeSubStreams } from '../../src/services/category.service.js';

// Home rankeado para logueados: rotación por visita (semilla), visita
// reutilizable, cupo de exploración, decay de la afinidad, frescura por última
// actividad, intensidad por rampa de cuentas activas, filtro de bloqueos.
// Invitados: cronológico intacto.

beforeEach(() => {
  _setFeedSeedOverride(777);
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
  return res.body;
}

async function paginateAll(opts, limit) {
  const out = [];
  let cursor = null;
  for (let p = 0; p < 60; p++) {
    const body = await fetchFeed({ ...opts, limit, cursor });
    out.push(...body.data.map(it => `${it.tipo}-${it.id}`));
    cursor = body.nextCursor;
    if (!cursor) return out;
  }
  throw new Error('paginateAll: demasiadas páginas');
}

const decode = (b64) => JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
const catIds = (body) => body.data.filter(it => it.tipo === 'categoria').map(it => it.id);
const comIds = (body) => body.data.filter(it => it.tipo === 'comentario').map(it => it.id);
const comId = (c) => c.contenido_id ?? c.id;

const block = (bloqueadorId, bloqueadoId) => pool.query(
  'INSERT INTO bloqueo (bloqueador_id, bloqueado_id) VALUES ($1, $2)', [bloqueadorId, bloqueadoId]);

describe('Rotación por visita', () => {
  test('semillas distintas → orden distinto, mismo conjunto; misma semilla pagina sin repetir ni saltear', async () => {
    const otro = await registerAndLogin();
    const creadas = [];
    for (let i = 0; i < 12; i++) creadas.push(await createCategory(otro.cookie));
    const yo = await registerAndLogin();

    _setFeedSeedOverride(1);
    const a = catIds(await fetchFeed({ cookie: yo.cookie, limit: 50 }));
    _setFeedSeedOverride(2);
    const b = catIds(await fetchFeed({ cookie: yo.cookie, limit: 50 }));

    expect(a).toHaveLength(12);
    expect(new Set(a)).toEqual(new Set(creadas.map(c => c.id)));
    expect(new Set(b)).toEqual(new Set(a));
    expect(b).not.toEqual(a);

    // Misma semilla, páginas de 5 hasta el final.
    _setFeedSeedOverride(1);
    const paginado = await paginateAll({ cookie: yo.cookie }, 5);
    expect(paginado).toHaveLength(12);
    expect(new Set(paginado).size).toBe(12);
  });

  test('visita: la página 1 pedida con la `visita` devuelta reproduce el orden', async () => {
    const otro = await registerAndLogin();
    for (let i = 0; i < 8; i++) await createCategory(otro.cookie);
    for (let i = 0; i < 4; i++) await createHomeReply(otro.cookie, { cuerpo: `h${i}` });
    const yo = await registerAndLogin();

    _setFeedSeedOverride(11);
    const p1 = await fetchFeed({ cookie: yo.cookie, limit: 50 });
    expect(typeof p1.visita).toBe('string');

    // Otra semilla para "visitas nuevas": la visita reutilizada debe ganarle.
    _setFeedSeedOverride(99);
    const again = await fetchFeed({ cookie: yo.cookie, limit: 50, visita: p1.visita });
    expect(again.data.map(it => `${it.tipo}-${it.id}`)).toEqual(p1.data.map(it => `${it.tipo}-${it.id}`));
    expect(again.visita).toBe(p1.visita);

    // Una visita basura se ignora (visita nueva), sin 400.
    const basura = await fetchFeed({ cookie: yo.cookie, limit: 50, visita: 'xx' });
    expect(basura.data).toHaveLength(p1.data.length);
  });

  test('visita vencida se ignora (visita nueva)', async () => {
    const otro = await registerAndLogin();
    await createCategory(otro.cookie);
    const yo = await registerAndLogin();
    const vieja = Buffer.from(JSON.stringify({
      v: 3, t0: Math.floor(Date.now() / 1000) - 7 * 3600, seed: 5, w: 1,
    })).toString('base64url');
    const body = await fetchFeed({ cookie: yo.cookie, visita: vieja });
    expect(body.visita).not.toBe(vieja);
    expect(decode(body.visita).seed).toBe(777);
  });
});

describe('Cupo de exploración', () => {
  test('una categoría ajena y más vieja aparece entre las primeras 5 (w=1)', async () => {
    const yo = await registerAndLogin();
    for (let i = 0; i < 6; i++) await createCategory(yo.cookie); // participo (moderador)

    const desconocido = await registerAndLogin();
    const ajena = await createCategory(desconocido.cookie);
    await pool.query(`UPDATE categoria SET fecha_creacion = NOW() - INTERVAL '2 days' WHERE id = $1`, [ajena.id]);

    const cats = catIds(await fetchFeed({ cookie: yo.cookie, limit: 20 }));
    expect(cats).toHaveLength(7);
    expect(cats.indexOf(ajena.id)).toBeGreaterThanOrEqual(0);
    expect(cats.indexOf(ajena.id)).toBeLessThan(5);
  });

  test('un comentario de Home de un no-seguido aparece entre los primeros 5 (w=1)', async () => {
    const seguido = await registerAndLogin();
    const yo = await registerAndLogin();
    const f = await request(app).post(`/api/users/${seguido.user.nickname}/follow`).set('Cookie', yo.cookie);
    expect(f.status).toBeLessThan(400);
    for (let i = 0; i < 6; i++) await createHomeReply(seguido.cookie, { cuerpo: `seguido ${i}` });

    const otro = await registerAndLogin();
    const ajeno = await createHomeReply(otro.cookie, { cuerpo: 'ajeno' });
    await pool.query(`UPDATE contenido SET fecha_creacion = NOW() - INTERVAL '2 days' WHERE id = $1`, [comId(ajeno)]);

    const coms = comIds(await fetchFeed({ cookie: yo.cookie, limit: 20 }));
    expect(coms).toHaveLength(7);
    expect(coms.indexOf(comId(ajeno))).toBeGreaterThanOrEqual(0);
    expect(coms.indexOf(comId(ajeno))).toBeLessThan(5);
  });
});

describe('Decay y frescura', () => {
  test('participación de hace 60 días: queda detrás de una ajena suscripta con actividad de hoy', async () => {
    const yo = await registerAndLogin();
    const otro = await registerAndLogin();

    // Mi categoría vieja: participación y creación hace 60 días, pero con un tema
    // de otro HOY (misma edad que la ajena) → solo la separa la afinidad decaída.
    const vieja = await createCategory(yo.cookie);
    await pool.query(`UPDATE categoria SET fecha_creacion = NOW() - INTERVAL '60 days' WHERE id = $1`, [vieja.id]);
    await pool.query(
      `UPDATE participacion_categoria SET fecha_asignacion = NOW() - INTERVAL '60 days'
       WHERE categoria_id = $1 AND usuario_id = $2`, [vieja.id, yo.user.id]);
    await createTopic(otro.cookie, { categoria_id: vieja.id });

    const ajena = await createCategory(otro.cookie);
    await createTopic(otro.cookie, { categoria_id: ajena.id });
    const sub = await request(app).post(`/api/categories/${ajena.id}/subscribe`).set('Cookie', yo.cookie);
    expect(sub.status).toBeLessThan(400);

    for (const seed of [1, 2, 3]) {
      _setFeedSeedOverride(seed);
      const cats = catIds(await fetchFeed({ cookie: yo.cookie }));
      expect(cats.indexOf(ajena.id)).toBeLessThan(cats.indexOf(vieja.id));
    }
  });

  test('participación por un comentario de hace 60 días, sin actividad nueva: queda detrás de mis afines frescas', async () => {
    const yo = await registerAndLogin();
    const otro = await registerAndLogin();

    // Categoría ajena vieja donde comenté hace 60 días (participo, decaído).
    const vieja = await createCategory(otro.cookie);
    const mio = await createReply(yo.cookie, { categoria_id: vieja.id, cuerpo: 'hace mucho' });
    await pool.query(`UPDATE categoria SET fecha_creacion = NOW() - INTERVAL '60 days' WHERE id = $1`, [vieja.id]);
    await pool.query(`UPDATE contenido SET fecha_creacion = NOW() - INTERVAL '60 days' WHERE id = $1`, [comId(mio)]);
    await pool.query(
      `UPDATE participacion_categoria SET fecha_asignacion = NOW() - INTERVAL '60 days'
       WHERE categoria_id = $1`, [vieja.id]);

    // Dos categorías mías frescas (afines) y una ajena con actividad hoy.
    const m1 = await createCategory(yo.cookie);
    const m2 = await createCategory(yo.cookie);
    const ajena = await createCategory(otro.cookie);
    await createTopic(otro.cookie, { categoria_id: ajena.id });

    const cats = catIds(await fetchFeed({ cookie: yo.cookie }));
    // La vieja (afín pero decaída y sin actividad) queda última entre las afines.
    expect(cats.indexOf(vieja.id)).toBeGreaterThan(cats.indexOf(m1.id));
    expect(cats.indexOf(vieja.id)).toBeGreaterThan(cats.indexOf(m2.id));
    expect(cats).toContain(ajena.id);
  });

  test('foro chico (w=0): pasada la ventana de 7 días la frescura empata y rota; dentro de la ventana gana lo nuevo', async () => {
    _setFeedIntensityOverride(0);
    const otro = await registerAndLogin();
    const hace30 = await createCategory(otro.cookie);
    const hace70 = await createCategory(otro.cookie);
    const hace1 = await createCategory(otro.cookie);
    const hace6 = await createCategory(otro.cookie);
    for (const [cat, dias] of [[hace30, 30], [hace70, 70], [hace1, 1], [hace6, 6]]) {
      await pool.query(
        `UPDATE categoria SET fecha_creacion = NOW() - MAKE_INTERVAL(days => $2) WHERE id = $1`, [cat.id, dias]);
    }
    const yo = await registerAndLogin();

    const viejasPrimero = new Set();
    for (let seed = 1; seed <= 30; seed++) {
      _setFeedSeedOverride(seed);
      const ids = catIds(await fetchFeed({ cookie: yo.cookie }));
      // Ambas fuera de la ventana: el orden entre ellas lo decide la rotación.
      viejasPrimero.add(ids.indexOf(hace30.id) < ids.indexOf(hace70.id) ? 30 : 70);
      // Dentro de la ventana la frescura sigue mandando.
      expect(ids.indexOf(hace1.id)).toBeLessThan(ids.indexOf(hace6.id));
    }
    expect(viejasPrimero).toEqual(new Set([30, 70]));
  });

  test('última actividad: categoría vieja con tema nuevo le gana a una creada ayer sin actividad', async () => {
    const otro = await registerAndLogin();
    const vieja = await createCategory(otro.cookie);
    const ayer = await createCategory(otro.cookie);
    await pool.query(`UPDATE categoria SET fecha_creacion = NOW() - INTERVAL '30 days' WHERE id = $1`, [vieja.id]);
    await pool.query(`UPDATE categoria SET fecha_creacion = NOW() - INTERVAL '1 day' WHERE id = $1`, [ayer.id]);
    await createTopic(otro.cookie, { categoria_id: vieja.id });

    const yo = await registerAndLogin();
    for (const seed of [1, 2, 3]) {
      _setFeedSeedOverride(seed);
      const cats = catIds(await fetchFeed({ cookie: yo.cookie }));
      expect(cats.indexOf(vieja.id)).toBeLessThan(cats.indexOf(ayer.id));
    }
  });
});

describe('Intensidad por rampa', () => {
  test('computeIntensity: ≤250 → 0, 300 → 0.5, ≥350 → 1', () => {
    expect(computeIntensity(0, 300, 50)).toBe(0);
    expect(computeIntensity(250, 300, 50)).toBe(0);
    expect(computeIntensity(300, 300, 50)).toBe(0.5);
    expect(computeIntensity(350, 300, 50)).toBe(1);
    expect(computeIntensity(10000, 300, 50)).toBe(1);
  });

  test('perfilDesdeIntensidad interpola los extremos', () => {
    expect(perfilDesdeIntensidad(0)).toMatchObject({ G: 1.6, K: 0.3, J: 0.7, EXPLORA_CADA: 3, VENTANA_H: 168 });
    expect(perfilDesdeIntensidad(1)).toMatchObject({ G: 1.2, K: 2.0, J: 0.2, EXPLORA_CADA: 5 });
    expect(perfilDesdeIntensidad(1).VENTANA_H).toBeCloseTo(3650 * 24);
    // La ventana se abre de forma geométrica (gradual), no de golpe.
    expect(perfilDesdeIntensidad(0.5).VENTANA_H).toBeCloseTo(Math.sqrt(168 * 3650 * 24));
  });

  test('con umbral de env y cuentas activas reales, el cursor congela w=1', async () => {
    const prev = {
      U: process.env.FEED_UMBRAL_CUENTAS, A: process.env.FEED_UMBRAL_ANCHO,
      F: process.env.FEED_INTENSIDAD_FORZADA,
    };
    try {
      process.env.FEED_UMBRAL_CUENTAS = '3';
      process.env.FEED_UMBRAL_ANCHO = '1';
      delete process.env.FEED_INTENSIDAD_FORZADA;
      _resetFeedRanking();
      _setFeedSeedOverride(777);
      _setFeedIntensityOverride(null);

      const users = [];
      for (let i = 0; i < 5; i++) users.push(await registerAndLogin());
      await createCategory(users[0].cookie);
      await createCategory(users[0].cookie);

      const body = await fetchFeed({ cookie: users[1].cookie, limit: 1 });
      expect(body.nextCursor).toBeTruthy();
      expect(decode(body.nextCursor).w).toBe(1);
      expect(decode(body.visita).w).toBe(1);
    } finally {
      for (const [k, v] of [['FEED_UMBRAL_CUENTAS', prev.U], ['FEED_UMBRAL_ANCHO', prev.A], ['FEED_INTENSIDAD_FORZADA', prev.F]]) {
        if (v === undefined) delete process.env[k]; else process.env[k] = v;
      }
    }
  });

  test('cruce del umbral a mitad de scroll: la página 2 conserva el w del cursor', async () => {
    const otro = await registerAndLogin();
    for (let i = 0; i < 8; i++) await createCategory(otro.cookie);
    const yo = await registerAndLogin();

    _setFeedIntensityOverride(0);
    const p1 = await fetchFeed({ cookie: yo.cookie, limit: 3 });
    expect(decode(p1.nextCursor).w).toBe(0);

    _setFeedIntensityOverride(1);
    const p2 = await fetchFeed({ cookie: yo.cookie, limit: 3, cursor: p1.nextCursor });
    expect(decode(p2.nextCursor).w).toBe(0);
    const p3 = await fetchFeed({ cookie: yo.cookie, limit: 3, cursor: p2.nextCursor });

    const ids = [...p1.data, ...p2.data, ...p3.data].map(it => it.id);
    expect(ids).toHaveLength(8);
    expect(new Set(ids).size).toBe(8);
  });
});

describe('mergeSubStreams', () => {
  test('cupo: la posición k sale de exploración si k % N == N−1; vacío → el otro', () => {
    const a = [1, 2, 3, 4, 5, 6].map(id => ({ id }));
    const e = [101, 102].map(id => ({ id }));
    const m = mergeSubStreams(a, e, 0, 3, 10);
    expect(m.map(x => x.row.id)).toEqual([1, 2, 101, 3, 4, 102, 5, 6]);
    // Arrancando en k0=2 la primera posición ya es de exploración.
    expect(mergeSubStreams(a, e, 2, 3, 2).map(x => x.sub)).toEqual(['e', 'a']);
    // Sin afines, todo es exploración.
    expect(mergeSubStreams([], e, 0, 3, 10).map(x => x.row.id)).toEqual([101, 102]);
  });
});

describe('Bloqueos', () => {
  test.each([
    ['yo bloqueo al autor', true],
    ['el autor me bloquea', false],
  ])('%s: sus comentarios de Home no aparecen, su categoría SÍ, y la card no expone su contenido', async (_name, yoBloqueo) => {
    const yo = await registerAndLogin();
    const bloq = await registerAndLogin();
    const otro = await registerAndLogin();

    const comBloq = await createHomeReply(bloq.cookie, { cuerpo: 'del bloqueado' });
    const comOtro = await createHomeReply(otro.cookie, { cuerpo: 'de otro' });
    const catBloq = await createCategory(bloq.cookie);

    // Categoría de otro donde el bloqueado publica lo último.
    const cat = await createCategory(otro.cookie);
    await createTopic(otro.cookie, { categoria_id: cat.id, titulo: 'tema de otro' });
    await createReply(otro.cookie, { categoria_id: cat.id, cuerpo: 'comentario de otro' });
    await createTopic(bloq.cookie, { categoria_id: cat.id, titulo: 'tema del bloqueado' });
    await createReply(bloq.cookie, { categoria_id: cat.id, cuerpo: 'comentario del bloqueado' });

    if (yoBloqueo) await block(yo.user.id, bloq.user.id);
    else await block(bloq.user.id, yo.user.id);

    const body = await fetchFeed({ cookie: yo.cookie, limit: 50 });
    const coms = comIds(body);
    expect(coms).not.toContain(comId(comBloq));
    expect(coms).toContain(comId(comOtro));

    const cats = catIds(body);
    expect(cats).toContain(catBloq.id);

    const card = body.data.find(it => it.tipo === 'categoria' && it.id === cat.id);
    expect(card.ultimo_tema.autor).toBe(otro.user.nickname);
    expect(card.ultimo_tema.titulo).toBe('tema de otro');
    expect(card.ultimo_comentario.autor_nickname).toBe(otro.user.nickname);

    // Un invitado sí ve el contenido del "bloqueado" (no hay bloqueo).
    const guest = await fetchFeed({ limit: 50 });
    const gCard = guest.data.find(it => it.tipo === 'categoria' && it.id === cat.id);
    expect(gCard.ultimo_tema.autor).toBe(bloq.user.nickname);
    expect(comIds(guest)).toContain(comId(comBloq));
  });

  test('comentario de Home fijado de un bloqueado no encabeza mi Home', async () => {
    const admin = await createAdmin();
    const yo = await registerAndLogin();
    const bloq = await registerAndLogin();
    await createCategory(admin.cookie);
    const com = await createHomeReply(bloq.cookie, { cuerpo: 'fijado del bloqueado' });
    const pin = await request(app).post(`/api/replies/${comId(com)}/pin-home`)
      .set('Cookie', admin.cookie).send({ dias: 7 });
    expect(pin.status).toBeLessThan(400);

    await block(yo.user.id, bloq.user.id);

    const mine = await fetchFeed({ cookie: yo.cookie, limit: 50 });
    expect(mine.data.some(it => it.tipo === 'comentario' && it.id === comId(com))).toBe(false);

    // Para un tercero sigue encabezando.
    const tercero = await registerAndLogin();
    const suyo = await fetchFeed({ cookie: tercero.cookie, limit: 50 });
    expect(suyo.data[0].tipo).toBe('comentario');
    expect(suyo.data[0].id).toBe(comId(com));
    expect(suyo.data[0].fijado_home).toBe(true);
  });

  test('categoría fijada: su card no expone contenido de un bloqueado', async () => {
    const admin = await createAdmin();
    const yo = await registerAndLogin();
    const bloq = await registerAndLogin();
    const cat = await createCategory(admin.cookie);
    await createTopic(admin.cookie, { categoria_id: cat.id, titulo: 'tema admin' });
    await createTopic(bloq.cookie, { categoria_id: cat.id, titulo: 'tema bloq' });
    const pin = await request(app).post(`/api/categories/${cat.id}/pin-home`)
      .set('Cookie', admin.cookie).send({ dias: 7 });
    expect(pin.status).toBeLessThan(400);
    await block(bloq.user.id, yo.user.id);

    const body = await fetchFeed({ cookie: yo.cookie });
    expect(body.data[0].id).toBe(cat.id);
    expect(body.data[0].fijada).toBe(true);
    expect(body.data[0].ultimo_tema.titulo).toBe('tema admin');
  });
});

describe('Invitados intactos', () => {
  test('cronológico, cursor v2 y sin visita', async () => {
    const autor = await registerAndLogin();
    const c1 = await createCategory(autor.cookie);
    const c2 = await createCategory(autor.cookie);
    const c3 = await createCategory(autor.cookie);

    const p1 = await fetchFeed({ limit: 2 });
    expect(p1.visita).toBeUndefined();
    expect(p1.data.map(c => c.id)).toEqual([c3.id, c2.id]);
    const cur = decode(p1.nextCursor);
    expect(cur.v).toBe(2);
    expect(cur.m).toBe('c');

    const p2 = await fetchFeed({ limit: 2, cursor: p1.nextCursor });
    expect(p2.data.map(c => c.id)).toEqual([c1.id]);
    expect(p2.nextCursor).toBeNull();
  });
});
