import { getTopicById } from '../repositories/topic.repository.js';
import { assignParticipantRole } from '../repositories/category.repository.js';
import { getCategoryById } from '../repositories/category.repository.js';

import { createReply, getRepliesByCategoryId, getRepliesByTopicId, getReplyById, 
  deleteReplyById, getRepliesByAuthorId, getRepliesByUserId, updateReplyById } from '../repositories/reply.repository.js';

const createReplyService = async (autorId, { cuerpo, tema_id, categoria_id }) => {
  if (!cuerpo?.trim()) {
    const err = new Error('El contenido no puede estar vacío');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (!tema_id && !categoria_id) {
    const err = new Error('Debe especificar una categoría o un tema');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (tema_id && categoria_id) {
    const err = new Error('No puede especificar categoría y tema al mismo tiempo');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  // Validar que el destino existe y está activo
  if (tema_id) {
    const topic = await getTopicById(tema_id);
    if (!topic) {
      const err = new Error('Tema no encontrado');
      err.code = 'NOT_FOUND';
      throw err;
    }
    if (topic.estado === 'inactivo') {
      const err = new Error('No se pueden comentar temas inactivos');
      err.code = 'FORBIDDEN';
      throw err;
    }
    // Asignar rol participante en la categoría del tema
    await assignParticipantRole(autorId, topic.categoria_id);
  }

  if (categoria_id) {
    const category = await getCategoryById(categoria_id);
    if (!category) {
      const err = new Error('Categoría no encontrada');
      err.code = 'NOT_FOUND';
      throw err;
    }
    if (category.estado === 'inactiva') {
      const err = new Error('No se pueden comentar categorías inactivas');
      err.code = 'FORBIDDEN';
      throw err;
    }
    await assignParticipantRole(autorId, categoria_id);
  }

  return await createReply({
    autor_id: autorId,
    cuerpo: cuerpo.trim(),
    tema_id: tema_id || null,
    categoria_id: categoria_id || null
  });
};

const getRepliesByCategoryIdService = async (categoriaId) => {
  return await getRepliesByCategoryId(categoriaId);
};

const getRepliesByTopicIdService = async (topicId) => {
  return await getRepliesByTopicId(topicId);
};

const getReplyByIdService = async (id) => {
  const reply = await getReplyById(id);
  if (!reply) {
    const err = new Error('Comentario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return reply;
};

const deleteReplyService = async (userId, userRol, replyId) => {
  const reply = await getReplyById(replyId);
  if (!reply) {
    const err = new Error('Comentario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (userRol !== 'admin' && reply.autor_id !== userId) {
    const err = new Error('No tenés permisos para eliminar este comentario');
    err.code = 'FORBIDDEN';
    throw err;
  }
  return await deleteReplyById(replyId);
};

const getMyRepliesService = async (autorId) => {
  return await getRepliesByAuthorId(autorId);
};

const getRepliesByUserIdService = async (userId) => {
  return await getRepliesByUserId(userId);
};

const updateReplyService = async (userId, userRol, replyId, { cuerpo }) => {
  if (!cuerpo?.trim()) {
    const err = new Error('El contenido no puede estar vacío');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const reply = await getReplyById(replyId);
  if (!reply) {
    const err = new Error('Comentario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (userRol !== 'admin' && reply.autor_id !== userId) {
    const err = new Error('No tenés permisos para editar este comentario');
    err.code = 'FORBIDDEN';
    throw err;
  }

  return await updateReplyById(replyId, { cuerpo: cuerpo.trim() });
};


export { createReplyService, getRepliesByCategoryIdService, getRepliesByTopicIdService, 
  deleteReplyService, getMyRepliesService, getRepliesByUserIdService, updateReplyService, getReplyByIdService };