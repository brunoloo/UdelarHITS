import { getTopicById, hardDeleteTopicById, topicHasContent } from '../repositories/topic.repository.js';
import {getCategoryById ,assignParticipantRole, categoryHasContent, hardDeleteCategoryById } from '../repositories/category.repository.js';


import { createReply, getRepliesByCategoryId, getRepliesByTopicId, getReplyById,
  deleteReplyById, getRepliesByAuthorId, getRepliesByUserId, getRepliesByCommentId,
  updateReplyById, replyHasReplies, hideReplyById, getParentComment, getReplyEditHistory } from '../repositories/reply.repository.js';
import { createNotification } from '../repositories/notification.repository.js';
import pool from '../config/db.js';

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
  let padre = null;
  if (comentario_padre_id) {
    padre = await getReplyById(comentario_padre_id);
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

  if (cuerpo.trim().length > 5000) {
    const err = new Error('El comentario superó el máximo de 5000 caracteres');
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

  const created = await createReply({
    autor_id: autorId,
    cuerpo: cuerpo.trim(),
    tema_id: tema_id || null,
    categoria_id: categoria_id || null,
    comentario_padre_id: comentario_padre_id || null
  });

  // Notificar al autor del comentario padre que recibió una respuesta.
  // Cada respuesta es un evento único (sin dedup). Nunca a uno mismo.
  if (comentario_padre_id && padre && padre.autor_id !== autorId) {
    const url = padre.tema_id ? `/topic/${padre.tema_id}`
      : padre.categoria_id ? `/category/${padre.categoria_id}` : null;
    const { rows } = await pool.query('SELECT nickname FROM usuario WHERE id = $1', [autorId]);
    const nick = rows[0]?.nickname;
    await createNotification({
      usuario_id: padre.autor_id,
      tipo: 'respuesta_comentario',
      mensaje: `${nick} respondió a tu comentario`,
      contenido_id: created.contenido_id,
      actor_id: autorId,
      url,
    });
  }

  return created;
};

const getRepliesByCategoryIdService = async (categoriaId, userId = null) => {
  return await getRepliesByCategoryId(categoriaId, userId);
};

const getRepliesByTopicIdService = async (topicId, userId = null) => {
  return await getRepliesByTopicId(topicId, userId);
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

async function cleanupOrphanedParents(commentId) {
  const hasReplies = await replyHasReplies(commentId);
  if (hasReplies) return; // todavía tiene otras respuestas, no borrar

  const parentInfo = await getParentComment(commentId);
  await deleteReplyById(commentId);

  // Seguir subiendo si el padre también está oculto y sin respuestas
  if (parentInfo?.padre_id && parentInfo.padre_estado === 'oculto') {
    await cleanupOrphanedParents(parentInfo.padre_id);
  }
}

const deleteReplyService = async (userId, userRol, replyId) => {
  const id = Number(replyId);
  if (!Number.isInteger(id) || id < 1) {
    const err = new Error('ID inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  
  const reply = await getReplyById(replyId);
  if (!reply) {
    const err = new Error('Comentario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (reply.estado === 'oculto') {
    const err = new Error('El comentario ya fue eliminado');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  if (userRol !== 'admin' && reply.autor_id !== userId) {
    const err = new Error('No tenés permisos para eliminar este comentario');
    err.code = 'FORBIDDEN';
    throw err;
  }

  const hasReplies = await replyHasReplies(replyId);

  if (hasReplies) {
    await hideReplyById(replyId);
    return { action: 'hidden' };
  }

  // Antes de eliminar, guardar info del padre
  const parentInfo = await getParentComment(replyId);

  await deleteReplyById(replyId);

  // Limpieza en cascada: si el padre está oculto y ya no tiene respuestas, eliminarlo también
  if (parentInfo?.padre_id && parentInfo.padre_estado === 'oculto') {
    await cleanupOrphanedParents(parentInfo.padre_id);
  }

  // Si el comentario pertenecía a un tema inactivo, verificar si se quedó vacío
  if (reply.tema_id) {
    const topic = await getTopicById(reply.tema_id);
    if (topic && topic.estado === 'inactivo') {
      const topicStillHasContent = await topicHasContent(reply.tema_id);
      if (!topicStillHasContent) {
        await hardDeleteTopicById(reply.tema_id);
      }
    }
  }

  // Si el comentario pertenecía directamente a una categoría inactiva
  if (reply.categoria_id) {
    const category = await getCategoryById(reply.categoria_id);
    if (category && category.estado === 'inactiva') {
      const catStillHasContent = await categoryHasContent(reply.categoria_id);
      if (!catStillHasContent) {
        await hardDeleteCategoryById(reply.categoria_id);
      }
    }
  }

  return { action: 'deleted' };
};

const getMyRepliesService = async (autorId) => {
  return await getRepliesByAuthorId(autorId);
};

const getRepliesByUserIdService = async (userId) => {
  return await getRepliesByUserId(userId);
};

const getRepliesByCommentIdService = async (commentId, userId = null) => {
  return await getRepliesByCommentId(commentId, userId);
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

  if (reply.autor_id !== userId) {
    const err = new Error('No tenés permisos para editar este comentario');
    err.code = 'FORBIDDEN';
    throw err;
  }

  return await updateReplyById(replyId, { cuerpo: cuerpo.trim() }, userId);
};

const getReplyEditHistoryService = async (replyId) => {
  const id = Number(replyId);
  if (!Number.isInteger(id) || id < 1) {
    const err = new Error('ID inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const reply = await getReplyById(replyId);
  if (!reply) {
    const err = new Error('Comentario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }

  return await getReplyEditHistory(replyId);
};

export { createReplyService, getRepliesByCategoryIdService, getRepliesByTopicIdService, 
  deleteReplyService, getMyRepliesService, getRepliesByUserIdService, updateReplyService, 
  getReplyByIdService, getRepliesByCommentIdService, getReplyEditHistoryService };