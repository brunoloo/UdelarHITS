import { createCategory, findCategoryByTitulo, getCategories, getCategoryById,
  getTopicsByCategoryId, deactivateCategoryById, activeCategoryById, getCategoriesByAuthorId,
  updateCategoryById, getActiveCategories, getParticipantsByCategoryId, getEtiquetas,
  getChronoFeed, getPersonalizedFeed, hasFeedSignals,
  getEtiquetasByIds, searchEtiquetas,
  hardDeleteCategoryById, categoryHasContent, getPopularCategories, getTrendingTags,
  getCategoryEditHistory, pinCategoryComment, unpinCategoryComment,
  pinCategoryTopic, unpinCategoryTopic,
  subscribeCategory, unsubscribeCategory, isSubscribedCategory } from '../repositories/category.repository.js';

import { cleanupInactiveTopics } from '../repositories/topic.repository.js';
import { FEED } from '../config/feedConfig.js';
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

  if (descripcion.trim().length > 750) {
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

  if (descripcion?.length > 750) {
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

const getActiveCategoriesService = async () => {
  return await getActiveCategories();
};

// ── Feed del Home (paginado por cursor) ──
// El cursor codifica en base64url el modo y la posición: {m:'p', s, id} para
// el feed personalizado (score + id) o {m:'c', f, id} para el cronológico
// (fecha + id). El modo va adentro para detectar cursores de otro modo
// (p. ej. el usuario cerró sesión a mitad de scroll) y rechazarlos.
const encodeFeedCursor = (payload) =>
  Buffer.from(JSON.stringify(payload)).toString('base64url');

const decodeFeedCursor = (cursor) => {
  try {
    const p = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (p?.m === 'p' && /^\d+$/.test(String(p.s)) && /^\d+$/.test(String(p.id))) return p;
    if (p?.m === 'c' && !isNaN(Date.parse(p.f)) && /^\d+$/.test(String(p.id))) return p;
  } catch { /* cae al throw de abajo */ }
  const err = new Error('Cursor de paginación inválido');
  err.code = 'BAD_REQUEST';
  throw err;
};

const getCategoryFeedService = async (user, { limit, cursor } = {}) => {
  const parsed = parseInt(limit, 10);
  const pageSize = Math.min(
    Math.max(Number.isNaN(parsed) ? FEED.PAGE_SIZE_DEFAULT : parsed, 1),
    FEED.PAGE_SIZE_MAX
  );

  // Personalizado solo si hay usuario con alguna señal (participación,
  // suscripción o likes). Cold start / invitado → cronológico, como Recientes.
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

  // Se pide una fila extra solo para saber si hay página siguiente.
  const rows = personalized
    ? await getPersonalizedFeed(user.id, {
        limit: pageSize + 1,
        cursorScore: cur?.s ?? null,
        cursorId: cur?.id ?? null,
      })
    : await getChronoFeed({
        limit: pageSize + 1,
        cursorFecha: cur?.f ?? null,
        cursorId: cur?.id ?? null,
      });

  const hasMore = rows.length > pageSize;
  const items = rows.slice(0, pageSize);

  let nextCursor = null;
  if (hasMore) {
    const last = items[items.length - 1];
    nextCursor = personalized
      ? encodeFeedCursor({ m: 'p', s: String(last.score), id: String(last.id) })
      : encodeFeedCursor({ m: 'c', f: new Date(last.fecha_creacion).toISOString(), id: String(last.id) });
  }

  // score es interno del ranking, no parte del contrato de la card
  for (const item of items) delete item.score;

  return { items, nextCursor };
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
  getActiveCategoriesService, getCategoryFeedService, getParticipantsByCategoryIdService, getEtiquetasService,
  searchEtiquetasService,
  getPopularCategoriesService, getTrendingTagsService, getCategoryEditHistoryService,
  pinCategoryItemService, unpinCategoryItemService,
  subscribeCategoryService, unsubscribeCategoryService, isSubscribedCategoryService };