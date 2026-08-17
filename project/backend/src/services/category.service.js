import { createCategory, findCategoryByTitulo, getCategories, getCategoryById,
  getTopicsByCategoryId, deactivateCategoryById, activeCategoryById, getCategoriesByAuthorId,
  updateCategoryById, getActiveCategories, getCategoryIndex, getParticipantsByCategoryId, getEtiquetas,
  getChronoFeed, getPersonalizedFeed, hasFeedSignals,
  getEtiquetasByIds, searchEtiquetas,
  hardDeleteCategoryById, categoryHasContent, getPopularCategories, getTrendingTags,
  getCategoryEditHistory, pinCategoryComment, unpinCategoryComment,
  pinCategoryTopic, unpinCategoryTopic,
  pinCategoryHome, unpinCategoryHome, getPinnedHomeCategory,
  subscribeCategory, unsubscribeCategory, isSubscribedCategory } from '../repositories/category.repository.js';

import { cleanupInactiveTopics } from '../repositories/topic.repository.js';
import { getHomeCommentsChrono, getHomeCommentsPersonalized } from '../repositories/reply.repository.js';
import { FEED, CADENCIA_HOME } from '../config/feedConfig.js';
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
// El cursor (base64url, versionado v:2) lleva el estado de AMBOS streams más la
// posición dentro del patrón de cadencia, para que el corte de página no
// reinicie el intercalado:
//   { v:2, m:'p'|'c', cat:{s,id}|{f,id}|null, com:{s,id}|{f,id}|null, slot:n }
// null = ese stream se agotó. `m` distingue personalizado/cronológico para
// rechazar un cursor de otro modo (login/logout a mitad de scroll). v:2 hace que
// un cursor viejo (formato Fase <22) devuelva 400 en vez de reinterpretarse mal.
const CADENCE_PATTERN = [
  ...Array(CADENCIA_HOME.categorias).fill('categoria'),
  ...Array(CADENCIA_HOME.comentarios).fill('comentario'),
];
const CADENCE_LEN = CADENCE_PATTERN.length;

const encodeFeedCursor = (payload) =>
  Buffer.from(JSON.stringify(payload)).toString('base64url');

// Valida la parte de un stream del cursor. Tres formas posibles:
//   null → stream agotado (no se vuelve a pedir)
//   {}   → activo pero sin avanzar (se pide desde el inicio). Ocurre cuando una
//          página no consumió nada de ese stream (p. ej. páginas muy chicas).
//   {id, s|f} → posición del último ítem consumido, según el modo.
const validStreamCursor = (c, mode) => {
  if (c === null) return true;
  if (typeof c !== 'object') return false;
  if (Object.keys(c).length === 0) return true;
  if (!/^\d+$/.test(String(c.id))) return false;
  return mode === 'p' ? /^\d+$/.test(String(c.s)) : !isNaN(Date.parse(c.f));
};

const decodeFeedCursor = (cursor) => {
  try {
    const p = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (p?.v === 2 && (p.m === 'p' || p.m === 'c')
        && Number.isInteger(p.slot) && p.slot >= 0
        && validStreamCursor(p.cat ?? null, p.m)
        && validStreamCursor(p.com ?? null, p.m)) {
      return { v: 2, m: p.m, cat: p.cat ?? null, com: p.com ?? null, slot: p.slot };
    }
  } catch { /* cae al throw de abajo */ }
  const err = new Error('Cursor de paginación inválido');
  err.code = 'BAD_REQUEST';
  throw err;
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

const getCategoryFeedService = async (user, { limit, cursor } = {}) => {
  const parsed = parseInt(limit, 10);
  const pageSize = Math.min(
    Math.max(Number.isNaN(parsed) ? FEED.PAGE_SIZE_DEFAULT : parsed, 1),
    FEED.PAGE_SIZE_MAX
  );

  // Personalizado solo si hay usuario con alguna señal (participación,
  // suscripción o likes). Cold start / invitado → cronológico, como Recientes.
  // El modo aplica a AMBOS streams.
  const personalized = user ? await hasFeedSignals(user.id) : false;
  const mode = personalized ? 'p' : 'c';

  let cur = null;
  if (cursor) {
    cur = decodeFeedCursor(cursor);
    if (cur.m !== mode) {
      const err = new Error('Cursor de paginación inválido');
      err.code = 'BAD_REQUEST';
      throw err;
    }
  }

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

  const [cats, coms] = await Promise.all([
    catActive
      ? (personalized
          ? getPersonalizedFeed(user.id, { limit: fetchN, cursorScore: catCur?.s ?? null, cursorId: catCur?.id ?? null })
          : getChronoFeed({ limit: fetchN, cursorFecha: catCur?.f ?? null, cursorId: catCur?.id ?? null }))
      : Promise.resolve([]),
    comActive
      ? (personalized
          ? getHomeCommentsPersonalized(user.id, { limit: fetchN, cursorScore: comCur?.s ?? null, cursorId: comCur?.id ?? null })
          : getHomeCommentsChrono({ limit: fetchN, cursorFecha: comCur?.f ?? null, cursorId: comCur?.id ?? null, viewerId: user?.id ?? null }))
      : Promise.resolve([]),
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
    return personalized
      ? { s: String(last.score), id: String(last.id) }
      : { f: new Date(last.fecha_creacion).toISOString(), id: String(last.id) };
  };

  const nextCat = nextStreamCursor(catActive, catCur, cats, usedCat);
  const nextCom = nextStreamCursor(comActive, comCur, coms, usedCom);
  const hasMore = nextCat !== null || nextCom !== null;
  const nextCursor = hasMore
    ? encodeFeedCursor({ v: 2, m: mode, cat: nextCat, com: nextCom, slot: endSlot })
    : null;

  // Normalizar a la forma de card + discriminador `tipo`. score/fijada_hasta son
  // internos del ranking, no parte del contrato de la card.
  const out = items.map(({ kind, row }) => {
    if (kind === 'categoria') {
      delete row.score; delete row.fijada_hasta; row.fijada = false;
      row.tipo = 'categoria';
    } else {
      delete row.score;
      row.tipo = 'comentario';
    }
    return row;
  });

  // Categoría fijada por un admin: encabeza el feed y sólo en la primera página,
  // FUERA del intercalado. Vive fuera del cursor (se excluye del stream A en el
  // repo), así no duplica ni desajusta la paginación. Expira sola (fijada_hasta).
  if (!cursor) {
    const pinned = await getPinnedHomeCategory();
    if (pinned) {
      delete pinned.score;
      delete pinned.fijada_hasta;
      pinned.fijada = true;
      pinned.tipo = 'categoria';
      // Defensa: el stream A ya la excluye, pero evitamos duplicarla igual.
      const rest = out.filter(it => !(it.tipo === 'categoria' && String(it.id) === String(pinned.id)));
      return { items: [pinned, ...rest], nextCursor };
    }
  }

  return { items: out, nextCursor };
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
  subscribeCategoryService, unsubscribeCategoryService, isSubscribedCategoryService };