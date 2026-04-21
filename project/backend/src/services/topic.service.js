import { getCategoryById, assignParticipantRole, getTopicsByCategoryId } from '../repositories/category.repository.js';

import { createTopic, findTopicByTituloAndCategoria, getTopics, getTopicById,
  getTopicsByAuthorId, updateTopicById, updateTopicEstado, decrementTopicCount, 
  incrementTopicCount, getTopicsByUserId } from '../repositories/topic.repository.js';

const createTopicService = async (autorId, { categoria_id, titulo, cuerpo }) => {
  if (!categoria_id || !titulo?.trim() || !cuerpo?.trim()) {
    const err = new Error('Faltan campos obligatorios');
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

  const existing = await findTopicByTituloAndCategoria(titulo.trim(), categoria_id);
  if (existing) {
    const err = new Error('Ya existe un tema con ese título en esta categoría');
    err.code = 'TITULO_EXISTS';
    throw err;
  }

  const topic = await createTopic({
    autor_id: autorId,
    categoria_id,
    titulo: titulo.trim(),
    cuerpo: cuerpo.trim()
  });

  await assignParticipantRole(autorId, categoria_id);

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

  return await updateTopicById(topicId, { cuerpo: cuerpo.trim() });
};

const deleteTopicService = async (userId, userRol, topicId) => {
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

  return await updateTopicEstado(topicId, 'inactivo');
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

export { createTopicService, getTopicsService ,getTopicByIdService, getMyTopicsService, 
  updateTopicService, activeTopicService, deleteTopicService, getTopicsByCategoryIdService, getTopicsByUserIdService };