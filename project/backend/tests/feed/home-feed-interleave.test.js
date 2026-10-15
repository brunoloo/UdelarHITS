import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createCategory, createHomeReply } from '../helpers.js';
import { CADENCIA_HOME } from '../../src/config/feedConfig.js';
import {
  _setFeedIntensityOverride, _setFeedSeedOverride, _resetFeedRanking,
} from '../../src/services/feedRanking.service.js';

// Feed del Home = dos streams (categorías / comentarios de Home) rankeados por
// separado e intercalados por cadencia CADENCIA_HOME. Estos tests verifican el
// intercalado, el agotamiento de un stream, la paginación estable y el modo
// cronológico (invitados) y rankeado (logueados). El patrón esperado se DERIVA de la config (no se hardcodea 2:3),
// así siguen valiendo si se cambia la cadencia.

const CYCLE = [
  ...Array(CADENCIA_HOME.categorias).fill('C'),
  ...Array(CADENCIA_HOME.comentarios).fill('c'),
];
const CYCLE_LEN = CYCLE.length;
const expectedAt = (i) => CYCLE[i % CYCLE_LEN];

beforeEach(() => {
  _setFeedSeedOverride(4242);
  _setFeedIntensityOverride(1);
});
afterEach(() => _resetFeedRanking());

const fetchFeed = async ({ cookie = null, limit = 20, cursor = null, visita = null } = {}) => {
  let url = `/api/categories/feed?limit=${limit}`;
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;
  if (visita) url += `&visita=${encodeURIComponent(visita)}`;
  const req = request(app).get(url);
  if (cookie) req.set('Cookie', cookie);
  const res = await req;
  expect(res.status).toBe(200);
  return res.body;
};

const seqOf = (body) => body.data.map(it => (it.tipo === 'categoria' ? 'C' : 'c')).join('');
const keyOf = (it) => `${it.tipo}-${it.id}`;

// Siembra N categorías y M comentarios de Home intercalados en el tiempo.
async function seed(cookie, nCats, mComs) {
  const max = Math.max(nCats, mComs);
  for (let i = 0; i < max; i++) {
    if (i < nCats) await createCategory(cookie);
    if (i < mComs) await createHomeReply(cookie, { cuerpo: `com ${i}` });
  }
}

// Recorre todas las páginas y devuelve las claves compuestas en orden, más la
// `visita` de la página 1 (para reproducir el mismo orden rankeado en un fetch
// entero: misma t0/semilla/intensidad).
async function paginateWithVisit(opts, limit) {
  const out = [];
  let cursor = null;
  let visita = null;
  for (let p = 0; p < 60; p++) {
    const body = await fetchFeed({ ...opts, limit, cursor });
    if (p === 0) visita = body.visita ?? null;
    out.push(...body.data.map(keyOf));
    cursor = body.nextCursor;
    if (!cursor) break;
  }
  return { keys: out, visita };
}
const paginate = async (opts, limit) => (await paginateWithVisit(opts, limit)).keys;

describe('Feed Home — payload del comentario', () => {
  test('cada comentario trae la misma forma que en CategoryPage + tipo', async () => {
    const autor = await registerAndLogin();
    await createCategory(autor.cookie);
    const home = await createHomeReply(autor.cookie, { cuerpo: 'un comentario de home' });

    const viewer = await registerAndLogin();
    const body = await fetchFeed({ cookie: viewer.cookie });
    const com = body.data.find(it => it.tipo === 'comentario');
    expect(com.id).toBe(home.contenido_id);
    for (const k of ['cuerpo', 'likes', 'contador_respuestas', 'adjuntos', 'autor_nickname', 'encuesta', 'mi_reaccion']) {
      expect(com).toHaveProperty(k);
    }
    expect(com.estado).toBe('visible');
  });
});

describe('Feed Home — intercalado por cadencia', () => {
  test('cronológico (invitado): la página respeta el patrón de cadencia', async () => {
    const autor = await registerAndLogin();
    await seed(autor.cookie, 8, 8);

    const body = await fetchFeed({ limit: 10 });
    const seq = seqOf(body);
    // Con ambos streams con sobra, cada posición sigue la cadencia configurada.
    for (let i = 0; i < seq.length; i++) expect(seq[i]).toBe(expectedAt(i));
  });

  test('rankeado: la página respeta el mismo patrón de cadencia', async () => {
    const autor = await registerAndLogin();
    await seed(autor.cookie, 8, 8);
    const viewer = await registerAndLogin();

    const body = await fetchFeed({ cookie: viewer.cookie, limit: 10 });
    const seq = seqOf(body);
    for (let i = 0; i < seq.length; i++) expect(seq[i]).toBe(expectedAt(i));
  });

  test('cronológico: el patrón continúa a través del corte de página (page size NO múltiplo del ciclo)', async () => {
    const autor = await registerAndLogin();
    await seed(autor.cookie, 9, 9);

    const noMultiplo = CYCLE_LEN + 2; // p. ej. 7 con ciclo 5: no es múltiplo
    expect(noMultiplo % CYCLE_LEN).not.toBe(0);

    // La secuencia paginada debe ser idéntica a la del fetch entero: si el corte
    // reiniciara el patrón, divergirían.
    const paginadoSeq = [];
    let cursor = null;
    for (let p = 0; p < 30; p++) {
      const body = await fetchFeed({ limit: noMultiplo, cursor });
      paginadoSeq.push(seqOf(body));
      cursor = body.nextCursor;
      if (!cursor) break;
    }
    const entero = seqOf(await fetchFeed({ limit: 50 }));
    expect(paginadoSeq.join('')).toBe(entero);
  });

  test('rankeado: el patrón también continúa entre páginas', async () => {
    const autor = await registerAndLogin();
    await seed(autor.cookie, 9, 9);
    const viewer = await registerAndLogin();

    const { keys: paginado, visita } = await paginateWithVisit({ cookie: viewer.cookie }, CYCLE_LEN + 2);
    const entero = (await fetchFeed({ cookie: viewer.cookie, limit: 50, visita })).data.map(keyOf);
    expect(paginado).toEqual(entero);
  });
});

describe('Feed Home — agotamiento de un stream (sin huecos)', () => {
  test('cronológico: agotados los comentarios, el resto son categorías', async () => {
    const autor = await registerAndLogin();
    await seed(autor.cookie, 10, 2);

    const body = await fetchFeed({ limit: 20 });
    const seq = seqOf(body);
    expect(seq).toHaveLength(12);                       // sin huecos: 10 + 2
    expect(seq.split('').filter(x => x === 'c')).toHaveLength(2);
    // Tras el último comentario, todo lo que sigue es categoría (relleno gapless).
    const lastC = seq.lastIndexOf('c');
    expect(seq.slice(lastC + 1)).toMatch(/^C*$/);
  });

  test('cronológico: agotadas las categorías, el resto son comentarios', async () => {
    const autor = await registerAndLogin();
    await seed(autor.cookie, 2, 10);

    const body = await fetchFeed({ limit: 20 });
    const seq = seqOf(body);
    expect(seq).toHaveLength(12);
    expect(seq.split('').filter(x => x === 'C')).toHaveLength(2);
    const lastCat = seq.lastIndexOf('C');
    expect(seq.slice(lastCat + 1)).toMatch(/^c*$/);
  });

  test('rankeado: agotados los comentarios, el resto son categorías', async () => {
    const autor = await registerAndLogin();
    await seed(autor.cookie, 10, 2);
    const viewer = await registerAndLogin();

    const body = await fetchFeed({ cookie: viewer.cookie, limit: 20 });
    const seq = seqOf(body);
    expect(seq).toHaveLength(12);
    const lastC = seq.lastIndexOf('c');
    expect(seq.slice(lastC + 1)).toMatch(/^C*$/);
    expect(body.nextCursor).toBeNull();
  });

  test('cronológico: solo categorías → feed de categorías, sin huecos', async () => {
    const autor = await registerAndLogin();
    await seed(autor.cookie, 5, 0);
    const body = await fetchFeed({ limit: 10 });
    expect(body.data).toHaveLength(5);
    expect(body.data.every(it => it.tipo === 'categoria')).toBe(true);
    expect(body.nextCursor).toBeNull();
  });

  test('cronológico: solo comentarios → feed de comentarios, sin huecos', async () => {
    const autor = await registerAndLogin();
    await seed(autor.cookie, 0, 5);
    const body = await fetchFeed({ limit: 10 });
    expect(body.data).toHaveLength(5);
    expect(body.data.every(it => it.tipo === 'comentario')).toBe(true);
    expect(body.nextCursor).toBeNull();
  });
});

describe('Feed Home — paginación estable', () => {
  test('cronológico: page size no múltiplo del ciclo — no duplica ni omite', async () => {
    const autor = await registerAndLogin();
    await seed(autor.cookie, 13, 13);

    const paginado = await paginate({}, CYCLE_LEN + 2);
    expect(paginado).toHaveLength(26);
    expect(new Set(paginado).size).toBe(26);
    const entero = (await fetchFeed({ limit: 50 })).data.map(keyOf);
    expect(paginado).toEqual(entero);
  });

  test('cronológico: page size = 2 (un stream sin tocar por página) — estable', async () => {
    const autor = await registerAndLogin();
    await seed(autor.cookie, 6, 6);

    const paginado = await paginate({}, 2);
    expect(paginado).toHaveLength(12);
    expect(new Set(paginado).size).toBe(12);
    const entero = (await fetchFeed({ limit: 50 })).data.map(keyOf);
    expect(paginado).toEqual(entero);
  });

  test('rankeado: page size no múltiplo del ciclo — no duplica ni omite', async () => {
    const autor = await registerAndLogin();
    await seed(autor.cookie, 12, 12);
    const viewer = await registerAndLogin();

    const { keys: paginado, visita } = await paginateWithVisit({ cookie: viewer.cookie }, CYCLE_LEN + 2);
    expect(paginado).toHaveLength(24);
    expect(new Set(paginado).size).toBe(24);
    const entero = (await fetchFeed({ cookie: viewer.cookie, limit: 50, visita })).data.map(keyOf);
    expect(paginado).toEqual(entero);
  });

  test('rankeado: page size = 2 con afines y exploración — estable', async () => {
    const autor = await registerAndLogin();
    await seed(autor.cookie, 6, 6);
    // El viewer participa en 2 categorías propias y publica 2 comentarios de
    // Home propios → ambos streams tienen sub-stream afín y de exploración.
    const viewer = await registerAndLogin();
    await seed(viewer.cookie, 2, 2);

    const { keys: paginado, visita } = await paginateWithVisit({ cookie: viewer.cookie }, 2);
    expect(paginado).toHaveLength(16);
    expect(new Set(paginado).size).toBe(16);
    const entero = (await fetchFeed({ cookie: viewer.cookie, limit: 50, visita })).data.map(keyOf);
    expect(paginado).toEqual(entero);
  });

  test('rankeado con empates de señales: estable entre páginas', async () => {
    const autor = await registerAndLogin();
    // Comentarios sin likes ni respuestas: solo los separa el jitter y la edad.
    await seed(autor.cookie, 0, 14);
    const viewer = await registerAndLogin();

    const { keys: paginado, visita } = await paginateWithVisit({ cookie: viewer.cookie }, 5);
    expect(paginado).toHaveLength(14);
    expect(new Set(paginado).size).toBe(14);
    const entero = (await fetchFeed({ cookie: viewer.cookie, limit: 50, visita })).data.map(keyOf);
    expect(paginado).toEqual(entero);
  });
});

describe('Feed Home — cronológico (invitado)', () => {
  test('cada stream se ordena por fecha DESC dentro de su tipo', async () => {
    const autor = await registerAndLogin();
    await seed(autor.cookie, 4, 4);

    const body = await fetchFeed({ limit: 50 });
    const cats = body.data.filter(it => it.tipo === 'categoria').map(it => Number(it.id));
    const coms = body.data.filter(it => it.tipo === 'comentario').map(it => Number(it.id));
    // Creados en orden ascendente de id → cronológico DESC = id descendente.
    expect(cats).toEqual([...cats].sort((a, b) => b - a));
    expect(coms).toEqual([...coms].sort((a, b) => b - a));
  });
});
