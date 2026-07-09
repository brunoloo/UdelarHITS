import { getCategoryById, assignParticipantRole, getTopicsByCategoryId, categoryHasContent, hardDeleteCategoryById, getCategorySubscribers } from '../repositories/category.repository.js';

import { createTopic, findTopicByTituloAndCategoria, getTopics, getTopicById,
  getTopicsByAuthorId, updateTopicById, updateTopicEstado, decrementTopicCount,
  incrementTopicCount, getTopicsByUserId, topicHasContent,
  hardDeleteTopicById, getRecentTopics, getTrendingTopic, getTopicEditHistory,
  pinTopicComment, unpinTopicComment } from '../repositories/topic.repository.js';
import { createNotification } from '../repositories/notification.repository.js';
import pool from '../config/db.js';

const createTopicService = async (autorId, { categoria_id, titulo, cuerpo }) => {
  if (!categoria_id) {
    const err = new Error('Debe especificar una categoría');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (!titulo?.trim()) {
    const err = new Error('El título es obligatorio');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (!cuerpo?.trim()) {
    const err = new Error('El contenido es obligatorio');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const tituloNormalizado = titulo.trim().replace(/\s+/g, ' ');

  if (tituloNormalizado.length > 100) {
    const err = new Error('El título superó el máximo caracteres');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (cuerpo.trim().length > 500) {
    const err = new Error('El contenido superó el máximo caracteres');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const category = await getCategoryById(categoria_id);
  if (!category) {
    const err = new Error('Categoría no encontrada');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (category.estado === 'inactiva') {
    const err = new Error('No se pueden crear temas en una categoría inactiva');
    err.code = 'FORBIDDEN';
    throw err;
  }

  const existing = await findTopicByTituloAndCategoria(tituloNormalizado, categoria_id);
  if (existing) {
    const err = new Error('Ya existe un tema con ese título en esta categoría');
    err.code = 'TITULO_EXISTS';
    throw err;
  }

  const topic = await createTopic({
    autor_id: autorId,
    categoria_id,
    titulo: tituloNormalizado,
    cuerpo: cuerpo.trim()
  });

  await assignParticipantRole(autorId, categoria_id);

  // Notificaciones del nuevo tema (nunca a uno mismo).
  const { rows } = await pool.query('SELECT nickname FROM usuario WHERE id = $1', [autorId]);
  const nick = rows[0]?.nickname;

  // Autor de la categoría → "publicó un tema en tu categoría". Click → al tema.
  if (category.autor_id !== autorId) {
    await createNotification({
      usuario_id: category.autor_id,
      tipo: 'tema_en_categoria',
      mensaje: `${nick} publicó un tema en tu categoría ${category.titulo}`,
      contenido_id: topic.contenido_id,
      actor_id: autorId,
      url: `/topic/${topic.contenido_id}`,
    });
  }

  // Suscriptores de la categoría (campanita), excepto el actor y el autor (que
  // ya recibió la suya). Click → al tema; el preview muestra el título.
  const subs = await getCategorySubscribers(categoria_id, [autorId, category.autor_id]);
  for (const subId of subs) {
    await createNotification({
      usuario_id: subId,
      tipo: 'tema_categoria_seguida',
      mensaje: `${nick} creó un tema en ${category.titulo}`,
      contenido_id: topic.contenido_id,
      actor_id: autorId,
      url: `/topic/${topic.contenido_id}`,
    });
  }

  return topic;
};

const getTopicsService = async () => {
  return await getTopics();
};

const getTopicByIdService = async (id) => {
  if (!id) {
    const err = new Error('Falta el id');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  const topic = await getTopicById(id);
  if (!topic) {
    const err = new Error('Tema no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }
  // Ocultar metadatos de un tema inactivo (acceso por link directo: solo se ven comentarios)
  if (topic.estado === 'inactivo') {
    topic.titulo = null;
    topic.cuerpo = null;
    topic.autor_id = null;
    topic.autor_nickname = null;
    topic.autor_url_imagen = null;
  }
  // Si la categoría del tema está inactiva, ocultar su título también
  if (topic.categoria_estado === 'inactiva') {
    topic.categoria_titulo = null;
  }
  return topic;
};

const getMyTopicsService = async (autorId) => {
  return await getTopicsByAuthorId(autorId);
};

const updateTopicService = async (userId, topicId, { cuerpo }) => {
  if (!cuerpo?.trim()) {
    const err = new Error('El contenido no puede estar vacío');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (cuerpo.trim().length > 500) {
    const err = new Error('El contenido superó el máximo caracteres');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const topic = await getTopicById(topicId);
  if (!topic) {
    const err = new Error('Tema no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (topic.autor_id !== userId) {
    const err = new Error('No tenés permisos para editar este tema');
    err.code = 'FORBIDDEN';
    throw err;
  }

  return await updateTopicById(topicId, { cuerpo: cuerpo.trim() }, userId);
};

const deleteTopicService = async (userId, userRol, topicId) => {
  const id = Number(topicId);
  if (!Number.isInteger(id) || id < 1) {
    const err = new Error('ID inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  
  const topic = await getTopicById(topicId);
  if (!topic) {
    const err = new Error('Tema no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (topic.estado === 'inactivo') {
    const err = new Error('El tema ya está inactivo');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  if (userRol !== 'admin' && topic.autor_id !== userId) {
    const err = new Error('No tenés permisos para eliminar este tema');
    err.code = 'FORBIDDEN';
    throw err;
  }

  await decrementTopicCount(topic.categoria_id);

  const hasContent = await topicHasContent(topicId);

  if (hasContent) {
    await updateTopicEstado(topicId, 'inactivo');
    return { action: 'deactivated' };
  }

  await hardDeleteTopicById(topicId);

  // Si la categoría está inactiva, verificar si se quedó vacía
  const category = await getCategoryById(topic.categoria_id);
  if (category && category.estado === 'inactiva') {
    const catStillHasContent = await categoryHasContent(topic.categoria_id);
    if (!catStillHasContent) {
      await hardDeleteCategoryById(topic.categoria_id);
    }
  }

  return { action: 'deleted' };
};

const activeTopicService = async (userId, userRol, topicId) => {
  const topic = await getTopicById(topicId);
  if (!topic) {
    const err = new Error('Tema no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (topic.estado === 'activo') {
    const err = new Error('El tema ya está activo');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  if (userRol !== 'admin' && topic.autor_id !== userId) {
    const err = new Error('No tenés permisos para activar este tema');
    err.code = 'FORBIDDEN';
    throw err;
  }

  await incrementTopicCount(topic.categoria_id);

  return await updateTopicEstado(topicId, 'activo');
};

const getTopicsByCategoryIdService = async (categoriaId) => {
  return await getTopicsByCategoryId(categoriaId);
};

const getTopicsByUserIdService = async (userId) => {
  return await getTopicsByUserId(userId);
};

const getRecentTopicsService = async (limit) => {
  const safeLimit = Math.min(Math.max(parseInt(limit) || 20, 1), 50);
  return await getRecentTopics(safeLimit);
};

const getTrendingTopicService = async (days) => {
  const safeDays = Math.min(Math.max(parseInt(days) || 7, 1), 30);
  return await getTrendingTopic(safeDays);
};

const getTopicEditHistoryService = async (topicId) => {
  const id = Number(topicId);
  if (!Number.isInteger(id) || id < 1) {
    const err = new Error('ID inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const topic = await getTopicById(topicId);
  if (!topic) {
    const err = new Error('Tema no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }

  return await getTopicEditHistory(topicId);
};

// ── Fijar/desanclar un comentario en un tema (solo el creador o un admin) ──
const assertTopicModerator = async (userId, userRol, topicId) => {
  const topic = await getTopicById(topicId);
  if (!topic) {
    const err = new Error('Tema no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (topic.autor_id !== userId && userRol !== 'admin') {
    const err = new Error('No tenés permisos para fijar en este tema');
    err.code = 'FORBIDDEN';
    throw err;
  }
};

const pinTopicCommentService = async (userId, userRol, topicId, comentarioId) => {
  await assertTopicModerator(userId, userRol, topicId);
  if (!/^\d+$/.test(String(comentarioId))) {
    const err = new Error('Id inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  const res = await pinTopicComment(topicId, comentarioId);
  if (!res) {
    const err = new Error('El comentario no pertenece al tema o no es válido');
    err.code = 'BAD_REQUEST';
    throw err;
  }
};

const unpinTopicCommentService = async (userId, userRol, topicId) => {
  await assertTopicModerator(userId, userRol, topicId);
  await unpinTopicComment(topicId);
};

export { createTopicService, getTopicsService ,getTopicByIdService, getMyTopicsService,
  updateTopicService, activeTopicService, deleteTopicService, getTopicsByCategoryIdService,
  getTopicsByUserIdService, getRecentTopicsService, getTrendingTopicService, getTopicEditHistoryService,
  pinTopicCommentService, unpinTopicCommentService };