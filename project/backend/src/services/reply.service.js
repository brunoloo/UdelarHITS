import { getTopicById } from '../repositories/topic.repository.js';
import { assignParticipantRole } from '../repositories/category.repository.js';
import { getCategoryById } from '../repositories/category.repository.js';

import { createReply, getRepliesByCategoryId, getRepliesByTopicId, getReplyById, 
  deleteReplyById, getRepliesByAuthorId, getRepliesByUserId, getRepliesByCommentId, updateReplyById } from '../repositories/reply.repository.js';

const createReplyService = async (autorId, { cuerpo, tema_id, categoria_id, comentario_padre_id }) => {
  if (!cuerpo?.trim()) {
    const err = new Error('El contenido no puede estar vacío');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (!tema_id && !categoria_id && !comentario_padre_id) {
    const err = new Error('Debe especificar una categoría, un tema o un comentario padre');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  // Si es respuesta a un comentario, heredar el tema/categoría del padre
  if (comentario_padre_id) {
    const padre = await getReplyById(comentario_padre_id);
    if (!padre) {
      const err = new Error('Comentario padre no encontrado');
      err.code = 'NOT_FOUND';
      throw err;
    }
    // Heredar tema_id o categoria_id del padre
    if (!tema_id && !categoria_id) {
      tema_id = padre.tema_id || null;
      categoria_id = padre.categoria_id || null;
    }
  }

  if (cuerpo.trim().length > 2000) {
    const err = new Error('El comentario superó el máximo de 2000 caracteres');
    err.code = 'BAD_REQUEST';
    throw err;
  }

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
    await assignParticipantRole(autorId, topic.categoria_id);
  }

  if (categoria_id && !tema_id) {
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
    categoria_id: categoria_id || null,
    comentario_padre_id: comentario_padre_id || null
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

const getRepliesByCommentIdService = async (commentId) => {
  return await getRepliesByCommentId(commentId);
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
  deleteReplyService, getMyRepliesService, getRepliesByUserIdService, updateReplyService, 
  getReplyByIdService, getRepliesByCommentIdService };