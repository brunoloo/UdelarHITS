import { createCategory, findCategoryByTitulo, getCategories, getCategoryById,
  getTopicsByCategoryId, deactivateCategoryById, activeCategoryById, getCategoriesByAuthorId,
  updateCategoryById, getActiveCategories, getCategoryIndex, getParticipantsByCategoryId, getEtiquetas,
  getChronoFeed, getRankedCategoryFeed,
  getEtiquetasByIds, searchEtiquetas,
  hardDeleteCategoryById, categoryHasContent, getPopularCategories, getTrendingTags,
  getCategoryEditHistory, pinCategoryComment, unpinCategoryComment,
  pinCategoryTopic, unpinCategoryTopic,
  pinCategoryHome, unpinCategoryHome, getPinnedHomeCategory,
  subscribeCategory, unsubscribeCategory, isSubscribedCategory } from '../repositories/category.repository.js';

import { cleanupInactiveTopics } from '../repositories/topic.repository.js';
import { getHomeCommentsChrono, getRankedHomeComments, getPinnedHomeComment } from '../repositories/reply.repository.js';
import { FEED, CADENCIA_HOME, feedVisitaTtlHoras } from '../config/feedConfig.js';
import { getFeedIntensity, perfilDesdeIntensidad, newFeedSeed } from './feedRanking.service.js';
import { isValidCategoryIcon } from '../config/categoryIcons.js';

const createCategoryService = async (autorId, { titulo, descripcion, etiquetas }) => {
  if (!titulo?.trim()) {
    const err = new Error('El título es obligatorio');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (!descripcion?.trim()) {
    const err = new Error('La descripción es obligatoria');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (!etiquetas?.length) {
    const err = new Error('Debes seleccionar al menos una etiqueta');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const tituloNormalizado = titulo.trim().replace(/\s+/g, ' ');

  if (tituloNormalizado.length > 100) {
    const err = new Error('El título superó el máximo de caracteres');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (descripcion.trim().length > 1000) {
    const err = new Error('La descripción superó el máximo de caracteres');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const etiquetasArray = (Array.isArray(etiquetas) ? etiquetas : [etiquetas]).map(Number);

  if (etiquetasArray.some(id => !Number.isInteger(id) || id < 1)) {
    const err = new Error('Etiquetas inválidas');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const validIds = await getEtiquetasByIds(etiquetasArray);
  const invalidas = etiquetasArray.filter(id => !validIds.includes(id));
  if (invalidas.length > 0) {
    const err = new Error('Algunas etiquetas seleccionadas no existen');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const existing = await findCategoryByTitulo(tituloNormalizado);
  if (existing) {
    const err = new Error('Ya existe una categoría con ese título');
    err.code = 'TITULO_EXISTS';
    throw err;
  }

  return await createCategory({
    titulo: tituloNormalizado,
    descripcion: descripcion.trim(),
    autor_id: autorId,
    etiquetas: etiquetasArray
  });
};

const getCategoriesService = async () => {
  return await getCategories();
};

const getCategoryByIdService = async (id) => {
  if (!id) {
    const err = new Error('Falta el id');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  const category = await getCategoryById(id);
  if (!category) {
    const err = new Error('Categoría no encontrada');
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Ocultar metadatos de una categoría inactiva
  if (category.estado === 'inactiva') {
    category.titulo = null;
    category.descripcion = null;
    category.etiquetas = null;
    category.autor_id = null;
    category.autor_nickname = null;
    category.autor_url_imagen = null;
    category.contador_temas = null;
  }
  const topics = await getTopicsByCategoryId(id);
    return { ...category, topics };
};

const getMyCategoriesService = async (autorId) => {
  return await getCategoriesByAuthorId(autorId);
};

const deleteCategoryService = async (userId, userRol, categoryId) => {
  const id = Number(categoryId);
  if (!Number.isInteger(id) || id < 1) {
    const err = new Error('ID inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  
  const category = await getCategoryById(categoryId);

  if (!category) {
    const err = new Error('Categoría no encontrada');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (category.estado === 'inactiva') {
    const err = new Error('La categoría ya se eliminó');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (userRol !== 'admin' && category.autor_id !== userId) {
    const err = new Error('No tenés permisos para eliminar esta categoría');
    err.code = 'FORBIDDEN';
    throw err;
  }

  await cleanupInactiveTopics(categoryId);

  const hasContent = await categoryHasContent(categoryId);

  if (hasContent) {
    await deactivateCategoryById(categoryId);
    return { action: 'deactivated' };
  }

  await hardDeleteCategoryById(categoryId);
  return { action: 'deleted' };
};

const activeCategoryService = async (userId, userRol, categoryId) => {
  const category = await getCategoryById(categoryId);

  if (!category) {
    const err = new Error('Categoría no encontrada');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (category.estado === 'activa') {
    const err = new Error('La categoría ya está activa');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (userRol !== 'admin' && category.autor_id !== userId) {
    const err = new Error('No tenés permisos para activar esta categoría');
    err.code = 'FORBIDDEN';
    throw err;
  }
  return await activeCategoryById(categoryId);
};

const updateCategoryService = async (userId, userRol, categoryId, { descripcion, etiquetas, icono }) => {
  if (!descripcion && !etiquetas?.length && icono === undefined) {
    const err = new Error('No hay campos para actualizar');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const category = await getCategoryById(categoryId);
  if (!category) {
    const err = new Error('Categoría no encontrada');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (category.autor_id !== userId) {
    const err = new Error('No tenés permisos para editar esta categoría');
    err.code = 'FORBIDDEN';
    throw err;
  }

  if (descripcion?.length > 1000) {
    const err = new Error('La descripción superó el máximo de caracteres');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (etiquetas) {
    const ids = etiquetas.map(Number);
    if (ids.some(id => !Number.isInteger(id) || id < 1)) {
      const err = new Error('Etiquetas inválidas');
      err.code = 'BAD_REQUEST';
      throw err;
    }
    const validIds = await getEtiquetasByIds(ids);
    if (validIds.length !== ids.length) {
      const err = new Error('Algunas etiquetas seleccionadas no existen');
      err.code = 'BAD_REQUEST';
      throw err;
    }
  }

  if (icono !== undefined && !isValidCategoryIcon(icono)) {
    const err = new Error('Ícono inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  return await updateCategoryById(categoryId, { descripcion, etiquetas, icono }, userId);
};

const getActiveCategoriesService = async (filter = {}) => {
  return await getActiveCategories(filter);
};

const getCategoryIndexService = async () => {
  return await getCategoryIndex();
};

// ── Feed del Home: dos streams intercalados por cadencia ──
// El Home mezcla categorías (stream A) y comentarios de Home (stream B). Cada
// stream se rankea SOLO contra ítems de su tipo y luego se intercalan con una
// cadencia fija (CADENCIA_HOME): no compiten en un único ranking, así que no hay
// que calibrar magnitudes entre tipos. El balance se ajusta con la cadencia.
//
// Dos modos:
//   * Invitado → cronológico. Cursor v2 (base64url):
//       { v:2, m:'c', cat:{f,id}|{}|null, com:{f,id}|{}|null, slot:n }
//   * Logueado → rankeado (config/feedConfig.js). Cursor v3:
//       { v:3, m:'r', t0, seed, w, slot,
//         cat: null | { k, a: null|{}|{s,id}, e: null|{}|{s,id} }, com: ídem }
//     t0/seed/w congelan la visita (edades, jitter de rotación e intensidad no
//     cambian a mitad de scroll). Cada stream tiene dos sub-streams (a = afín,
//     e = exploración) y `k` es la posición dentro del stream, que decide el
//     cupo de exploración.
// null = agotado. Un cursor de otro modo (login/logout a mitad de scroll, o un
// v2 'p' de antes del deploy) responde 400.
const CADENCE_PATTERN = [
  ...Array(CADENCIA_HOME.categorias).fill('categoria'),
  ...Array(CADENCIA_HOME.comentarios).fill('comentario'),
];
const CADENCE_LEN = CADENCE_PATTERN.length;
const SEED_MAX = 2 ** 31;

const encodeFeedCursor = (payload) =>
  Buffer.from(JSON.stringify(payload)).toString('base64url');

const badCursor = () => {
  const err = new Error('Cursor de paginación inválido');
  err.code = 'BAD_REQUEST';
  return err;
};

// Entero en el rango de bigint de Postgres (si no, el cast $n::bigint falla → 500).
const BIGINT_MAX = 9223372036854775807n;
const isBigintStr = (v, { signed = false } = {}) => {
  const str = String(v);
  if (!(signed ? /^-?\d{1,19}$/ : /^\d{1,19}$/).test(str)) return false;
  const n = BigInt(str);
  return n <= BIGINT_MAX && n >= -BIGINT_MAX - 1n;
};

// Parte de un stream en modo cronológico:
//   null → agotado · {} → activo sin avanzar · {f,id} → último consumido.
const validChronoCursor = (c) => {
  if (c === null) return true;
  if (typeof c !== 'object' || Array.isArray(c)) return false;
  if (Object.keys(c).length === 0) return true;
  return isBigintStr(c.id) && !isNaN(Date.parse(c.f));
};

// Sub-stream rankeado: null | {} | {s,id} (s puede ser negativo).
const validRankedSub = (c) => {
  if (c === null) return true;
  if (typeof c !== 'object' || Array.isArray(c)) return false;
  if (Object.keys(c).length === 0) return true;
  return isBigintStr(c.s, { signed: true }) && isBigintStr(c.id);
};
const validRankedStream = (c) => {
  if (c === null) return true;
  if (typeof c !== 'object' || Array.isArray(c)) return false;
  return Number.isInteger(c.k) && c.k >= 0
    && validRankedSub(c.a ?? null) && validRankedSub(c.e ?? null);
};
const normRankedStream = (c) => (c === null ? null : { k: c.k, a: c.a ?? null, e: c.e ?? null });

const validVisitParams = (p, nowSec) =>
  Number.isInteger(p.t0) && p.t0 > 0 && p.t0 <= nowSec + 60
  && Number.isInteger(p.seed) && p.seed >= 0 && p.seed < SEED_MAX
  && typeof p.w === 'number' && p.w >= 0 && p.w <= 1;

const decodeFeedCursor = (cursor) => {
  try {
    const p = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (p?.v === 2 && p.m === 'c'
        && Number.isInteger(p.slot) && p.slot >= 0
        && validChronoCursor(p.cat ?? null)
        && validChronoCursor(p.com ?? null)) {
      return { v: 2, m: 'c', cat: p.cat ?? null, com: p.com ?? null, slot: p.slot };
    }
    if (p?.v === 3 && p.m === 'r'
        && Number.isInteger(p.slot) && p.slot >= 0
        && validVisitParams(p, Math.floor(Date.now() / 1000))
        && validRankedStream(p.cat ?? null)
        && validRankedStream(p.com ?? null)) {
      return {
        v: 3, m: 'r', t0: p.t0, seed: p.seed, w: p.w, slot: p.slot,
        cat: normRankedStream(p.cat ?? null), com: normRankedStream(p.com ?? null),
      };
    }
  } catch { /* cae al throw de abajo */ }
  throw badCursor();
};

// `visita` (base64url {v:3,t0,seed,w}): permite que un refetch de la página 1
// (invalidación tras like/comentario/pin) reproduzca el mismo orden. Inválida
// o vencida (FEED_VISITA_TTL_HORAS) → se ignora (visita nueva), nunca 400.
const decodeVisita = (visita) => {
  if (!visita || typeof visita !== 'string') return null;
  try {
    const p = JSON.parse(Buffer.from(visita, 'base64url').toString('utf8'));
    const nowSec = Math.floor(Date.now() / 1000);
    if (p?.v === 3 && validVisitParams(p, nowSec)
        && nowSec - p.t0 <= feedVisitaTtlHoras() * 3600) {
      return { t0: p.t0, seed: p.seed, w: p.w };
    }
  } catch { /* ignorada */ }
  return null;
};

// Intercalado determinístico de los dos streams (ya ordenados) según la cadencia,
// arrancando en `startSlot`. `slot` avanza una posición por cada ítem colocado;
// si el stream preferido por ese slot está agotado, se toma del otro (sin dejar
// huecos). Devuelve los ítems y cuántos se consumieron de cada stream.
function interleaveStreams(cats, coms, startSlot, pageSize) {
  const items = [];
  let ci = 0, mi = 0;
  let slot = ((startSlot % CADENCE_LEN) + CADENCE_LEN) % CADENCE_LEN;
  while (items.length < pageSize && (ci < cats.length || mi < coms.length)) {
    const pref = CADENCE_PATTERN[slot];
    let picked = null;
    if (pref === 'categoria') {
      if (ci < cats.length) picked = { kind: 'categoria', row: cats[ci++] };
      else if (mi < coms.length) picked = { kind: 'comentario', row: coms[mi++] };
    } else {
      if (mi < coms.length) picked = { kind: 'comentario', row: coms[mi++] };
      else if (ci < cats.length) picked = { kind: 'categoria', row: cats[ci++] };
    }
    if (!picked) break; // defensivo: ambos agotados
    items.push(picked);
    slot = (slot + 1) % CADENCE_LEN;
  }
  return { items, usedCat: ci, usedCom: mi, endSlot: slot };
}

// Cupo de exploración: mezcla los sub-streams afín / exploración (cada uno ya
// ordenado) en un único stream. La posición global k0+i sale de exploración si
// (k0+i) % N == N−1; si no, de afín. Si el preferido está vacío, el otro. Como
// cada sub trae fetchN filas salvo que esté realmente agotado, el resultado es
// el mismo pagine como pagine. Devuelve [{ row, sub: 'a'|'e' }].
function mergeSubStreams(afinRows, explRows, k0, N, fetchN) {
  const out = [];
  let ai = 0, ei = 0;
  while (out.length < fetchN && (ai < afinRows.length || ei < explRows.length)) {
    const k = k0 + out.length;
    const wantExpl = k % N === N - 1;
    if (wantExpl ? ei < explRows.length : ai >= afinRows.length) {
      out.push({ row: explRows[ei++], sub: 'e' });
    } else {
      out.push({ row: afinRows[ai++], sub: 'a' });
    }
  }
  return out;
}

const parsePageSize = (limit) => {
  const parsed = parseInt(limit, 10);
  return Math.min(
    Math.max(Number.isNaN(parsed) ? FEED.PAGE_SIZE_DEFAULT : parsed, 1),
    FEED.PAGE_SIZE_MAX
  );
};

// Destacado del Home fijado por un admin: encabeza el feed y sólo en la
// primera página, FUERA del intercalado. Vive fuera del cursor (se excluye del
// stream correspondiente en el repo), así no duplica ni desajusta la
// paginación. Expira solo (fijada_hasta / fijado_home_hasta). Es un singleton
// COMPARTIDO: a lo sumo hay una categoría fijada O un comentario fijado, nunca
// ambos (lo garantizan las operaciones de pin), así que la categoría tiene
// prioridad y, si no hay, va el comentario. Se piden en paralelo con los streams.
const fetchPinned = (viewerId) => Promise.all([
  getPinnedHomeCategory(viewerId),
  getPinnedHomeComment(viewerId),
]);

const prependPinned = (out, [pinnedCat, pinnedCom]) => {
  if (pinnedCat) {
    delete pinnedCat.score;
    delete pinnedCat.fijada_hasta;
    pinnedCat.fijada = true;
    pinnedCat.tipo = 'categoria';
    // Defensa: el stream A ya la excluye, pero evitamos duplicarla igual.
    const rest = out.filter(it => !(it.tipo === 'categoria' && String(it.id) === String(pinnedCat.id)));
    return [pinnedCat, ...rest];
  }
  if (pinnedCom) {
    delete pinnedCom.score;
    pinnedCom.fijado_home = true;
    pinnedCom.tipo = 'comentario';
    // Defensa: el stream B ya lo excluye, pero evitamos duplicarlo igual.
    const rest = out.filter(it => !(it.tipo === 'comentario' && String(it.id) === String(pinnedCom.id)));
    return [pinnedCom, ...rest];
  }
  return out;
};

// Normaliza a la forma de card + discriminador `tipo`. score/explora/fijada_hasta
// son internos del ranking, no parte del contrato de la card.
const toCards = (items) => items.map(({ kind, row }) => {
  delete row.score; delete row.explora;
  if (kind === 'categoria') {
    delete row.fijada_hasta; row.fijada = false;
    row.tipo = 'categoria';
  } else {
    row.tipo = 'comentario';
  }
  return row;
});

// Invitado: cronológico (como Recientes), cursor v2 'c'.
const getChronoHomeFeed = async (pageSize, cur, isFirstPage) => {
  // Se pide una fila extra por stream para saber si quedan más; y como una página
  // podría llenarse toda de un tipo (si el otro se agotó), pageSize+1 alcanza para
  // llenarla desde cualquiera de los dos.
  const fetchN = pageSize + 1;
  const catActive = !cur || cur.cat !== null; // false = agotado en páginas previas
  const comActive = !cur || cur.com !== null;
  // {} = "activo, desde el inicio" (página 1, o un stream que una página previa
  // no llegó a tocar); distinto de null (agotado).
  const catCur = cur ? cur.cat : {};
  const comCur = cur ? cur.com : {};
  const startSlot = cur ? cur.slot : 0;

  const [cats, coms, pinned] = await Promise.all([
    catActive
      ? getChronoFeed({ limit: fetchN, cursorFecha: catCur?.f ?? null, cursorId: catCur?.id ?? null })
      : Promise.resolve([]),
    comActive
      ? getHomeCommentsChrono({ limit: fetchN, cursorFecha: comCur?.f ?? null, cursorId: comCur?.id ?? null, viewerId: null })
      : Promise.resolve([]),
    isFirstPage ? fetchPinned(null) : Promise.resolve(null),
  ]);

  const { items, usedCat, usedCom, endSlot } = interleaveStreams(cats, coms, startSlot, pageSize);

  // Cursor de cada stream para la próxima página:
  //   null            → agotado (consumimos todo lo que había)
  //   incoming (igual) → no se consumió nada de ese stream en esta página
  //   última key       → posición del último ítem consumido
  const nextStreamCursor = (active, incoming, rows, used) => {
    if (!active) return null;
    const exhausted = used === rows.length && rows.length < fetchN;
    if (exhausted) return null;
    if (used === 0) return incoming;
    const last = rows[used - 1];
    return { f: new Date(last.fecha_creacion).toISOString(), id: String(last.id) };
  };

  const nextCat = nextStreamCursor(catActive, catCur, cats, usedCat);
  const nextCom = nextStreamCursor(comActive, comCur, coms, usedCom);
  const nextCursor = (nextCat !== null || nextCom !== null)
    ? encodeFeedCursor({ v: 2, m: 'c', cat: nextCat, com: nextCom, slot: endSlot })
    : null;

  const out = toCards(items);
  return { items: pinned ? prependPinned(out, pinned) : out, nextCursor };
};

// Logueado: rankeado, cursor v3 'r'.
const getRankedHomeFeed = async (user, pageSize, cur, visita) => {
  let t0, seed, w;
  if (cur) {
    ({ t0, seed, w } = cur);
  } else {
    const v = decodeVisita(visita);
    if (v) {
      ({ t0, seed, w } = v);
    } else {
      t0 = Math.floor(Date.now() / 1000);
      seed = newFeedSeed();
      w = await getFeedIntensity();
    }
  }
  const perfil = perfilDesdeIntensidad(w);
  const N = perfil.EXPLORA_CADA;
  const p = { G: perfil.G, K: perfil.K, J: perfil.J, W_POP: perfil.W_POP, VENTANA_H: perfil.VENTANA_H };

  const fetchN = pageSize + 1;
  const fresh = { k: 0, a: {}, e: {} };
  const catCur = cur ? cur.cat : fresh; // null = stream agotado
  const comCur = cur ? cur.com : fresh;
  const startSlot = cur ? cur.slot : 0;
  const opts = (c) => ({ limit: fetchN, t0, seed, p, afin: c.a, explora: c.e });

  const [catRows, comRows, pinned] = await Promise.all([
    catCur ? getRankedCategoryFeed(user.id, opts(catCur)) : Promise.resolve([]),
    comCur ? getRankedHomeComments(user.id, opts(comCur)) : Promise.resolve([]),
    cur ? Promise.resolve(null) : fetchPinned(user.id),
  ]);

  const split = (rows) => ({
    afin: rows.filter(r => !r.explora),
    expl: rows.filter(r => r.explora),
  });
  const catSplit = split(catRows);
  const comSplit = split(comRows);
  const catMerged = catCur ? mergeSubStreams(catSplit.afin, catSplit.expl, catCur.k, N, fetchN) : [];
  const comMerged = comCur ? mergeSubStreams(comSplit.afin, comSplit.expl, comCur.k, N, fetchN) : [];

  const { items, usedCat, usedCom, endSlot } = interleaveStreams(
    catMerged.map(x => x.row), comMerged.map(x => x.row), startSlot, pageSize);

  // Por sub-stream: null si estaba inactivo o se agotó; el entrante si esta
  // página no consumió nada de él; si no, la key del último consumido.
  const nextSub = (incoming, rows, consumed) => {
    if (incoming === null) return null;
    if (consumed.length === rows.length && rows.length < fetchN) return null;
    if (consumed.length === 0) return incoming;
    const last = consumed[consumed.length - 1];
    return { s: String(last.score), id: String(last.id) };
  };
  const nextStream = (incoming, sp, merged, used) => {
    if (incoming === null) return null;
    const consumed = merged.slice(0, used);
    const a = nextSub(incoming.a, sp.afin, consumed.filter(x => x.sub === 'a').map(x => x.row));
    const e = nextSub(incoming.e, sp.expl, consumed.filter(x => x.sub === 'e').map(x => x.row));
    if (a === null && e === null) return null;
    return { k: incoming.k + used, a, e };
  };

  const nextCat = nextStream(catCur, catSplit, catMerged, usedCat);
  const nextCom = nextStream(comCur, comSplit, comMerged, usedCom);
  const nextCursor = (nextCat !== null || nextCom !== null)
    ? encodeFeedCursor({ v: 3, m: 'r', t0, seed, w, slot: endSlot, cat: nextCat, com: nextCom })
    : null;

  const out = toCards(items);
  return {
    items: pinned ? prependPinned(out, pinned) : out,
    nextCursor,
    visita: encodeFeedCursor({ v: 3, t0, seed, w }),
  };
};

const getCategoryFeedService = async (user, { limit, cursor, visita } = {}) => {
  const pageSize = parsePageSize(limit);
  const mode = user ? 'r' : 'c';

  let cur = null;
  if (cursor) {
    cur = decodeFeedCursor(cursor);
    if (cur.m !== mode) throw badCursor();
  }

  return user
    ? getRankedHomeFeed(user, pageSize, cur, visita)
    : getChronoHomeFeed(pageSize, cur, !cursor);
};

const getParticipantsByCategoryIdService = async (userId, categoriaId) => {
  const category = await getCategoryById(categoriaId);
  if (!category) {
    const err = new Error('Categoría no encontrada');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (category.autor_id !== userId) {
    const err = new Error('No tenés permisos para ver los participantes');
    err.code = 'FORBIDDEN';
    throw err;
  }
  return await getParticipantsByCategoryId(categoriaId);
};

const getEtiquetasService = async () => {
  const rows = await getEtiquetas();
  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.grupo]) grouped[row.grupo] = [];
    grouped[row.grupo].push({ id: row.id, nombre: row.nombre, nombre_display: row.nombre_display });
  }
  return grouped;
};

const searchEtiquetasService = async (query) => {
  if (!query?.trim()) {
    return await getEtiquetasService();
  }
  return await searchEtiquetas(query.trim());
};

const getPopularCategoriesService = async (days, limit) => {
  const safeDays = Math.min(Math.max(parseInt(days) || 7, 1), 30);
  const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 50);
  return await getPopularCategories(safeDays, safeLimit);
};

const getTrendingTagsService = async (days, limit) => {
  const safeDays = Math.min(Math.max(parseInt(days) || 7, 1), 30);
  const safeLimit = Math.min(Math.max(parseInt(limit) || 8, 1), 20);
  return await getTrendingTags(safeDays, safeLimit);
};

const getCategoryEditHistoryService = async (categoryId) => {
  const id = Number(categoryId);
  if (!Number.isInteger(id) || id < 1) {
    const err = new Error('ID inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const category = await getCategoryById(categoryId);
  if (!category) {
    const err = new Error('Categoría no encontrada');
    err.code = 'NOT_FOUND';
    throw err;
  }

  return await getCategoryEditHistory(categoryId);
};

// ── Fijar/desanclar en una categoría (solo el creador o un admin) ──
const assertCategoryModerator = async (userId, userRol, categoryId) => {
  const category = await getCategoryById(categoryId);
  if (!category) {
    const err = new Error('Categoría no encontrada');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (category.autor_id !== userId && userRol !== 'admin') {
    const err = new Error('No tenés permisos para fijar en esta categoría');
    err.code = 'FORBIDDEN';
    throw err;
  }
};

const pinCategoryItemService = async (userId, userRol, categoryId, tipo, itemId) => {
  await assertCategoryModerator(userId, userRol, categoryId);
  if (!/^\d+$/.test(String(itemId))) {
    const err = new Error('Id inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  let res;
  if (tipo === 'comentario') res = await pinCategoryComment(categoryId, itemId);
  else if (tipo === 'tema') res = await pinCategoryTopic(categoryId, itemId);
  else {
    const err = new Error('Tipo inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  if (!res) {
    const err = new Error('El elemento no pertenece a la categoría o no es válido');
    err.code = 'BAD_REQUEST';
    throw err;
  }
};

const unpinCategoryItemService = async (userId, userRol, categoryId, tipo) => {
  await assertCategoryModerator(userId, userRol, categoryId);
  if (tipo === 'comentario') await unpinCategoryComment(categoryId);
  else if (tipo === 'tema') await unpinCategoryTopic(categoryId);
  else {
    const err = new Error('Tipo inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }
};

// ── Fijar categoría en el Home (solo admin) ──
// Duraciones permitidas, en días. El admin elige una desde el modal del front.
const PIN_HOME_DIAS_VALIDOS = [3, 7, 30];

const pinCategoryHomeService = async (userRol, categoryId, dias) => {
  if (userRol !== 'admin') {
    const err = new Error('Solo un administrador puede fijar categorías');
    err.code = 'FORBIDDEN';
    throw err;
  }

  const id = Number(categoryId);
  if (!Number.isInteger(id) || id < 1) {
    const err = new Error('ID inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const diasNum = Number(dias);
  if (!PIN_HOME_DIAS_VALIDOS.includes(diasNum)) {
    const err = new Error('Duración inválida (permitido: 3, 7 o 30 días)');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const category = await getCategoryById(id);
  if (!category) {
    const err = new Error('Categoría no encontrada');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (category.estado !== 'activa') {
    const err = new Error('No se puede fijar una categoría inactiva');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const fijadaHasta = new Date(Date.now() + diasNum * 24 * 60 * 60 * 1000);
  const res = await pinCategoryHome(id, fijadaHasta);
  if (!res) {
    const err = new Error('No se pudo fijar la categoría');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  return res;
};

const unpinCategoryHomeService = async (userRol, categoryId) => {
  if (userRol !== 'admin') {
    const err = new Error('Solo un administrador puede desanclar categorías');
    err.code = 'FORBIDDEN';
    throw err;
  }
  const id = Number(categoryId);
  if (!Number.isInteger(id) || id < 1) {
    const err = new Error('ID inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  await unpinCategoryHome(id);
};

// ── Suscripción a categoría (campanita) ──
const assertCategoryExists = async (categoryId) => {
  const category = await getCategoryById(categoryId);
  if (!category) {
    const err = new Error('Categoría no encontrada');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return category;
};

const subscribeCategoryService = async (userId, categoryId) => {
  await assertCategoryExists(categoryId);
  await subscribeCategory(userId, categoryId);
};

const unsubscribeCategoryService = async (userId, categoryId) => {
  await unsubscribeCategory(userId, categoryId);
};

const isSubscribedCategoryService = async (userId, categoryId) => {
  return await isSubscribedCategory(userId, categoryId);
};

export { createCategoryService, getCategoriesService, getCategoryByIdService, deactivateCategoryById,
  deleteCategoryService, activeCategoryService, getMyCategoriesService, updateCategoryService,
  getActiveCategoriesService, getCategoryIndexService, getCategoryFeedService, getParticipantsByCategoryIdService, getEtiquetasService,
  searchEtiquetasService,
  getPopularCategoriesService, getTrendingTagsService, getCategoryEditHistoryService,
  pinCategoryItemService, unpinCategoryItemService,
  pinCategoryHomeService, unpinCategoryHomeService,
  subscribeCategoryService, unsubscribeCategoryService, isSubscribedCategoryService,
  mergeSubStreams };