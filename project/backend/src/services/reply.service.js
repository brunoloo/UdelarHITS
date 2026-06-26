import { getTopicById, hardDeleteTopicById, topicHasContent } from '../repositories/topic.repository.js';
import {getCategoryById ,assignParticipantRole, categoryHasContent, hardDeleteCategoryById, getCategorySubscribers } from '../repositories/category.repository.js';


import { createReply, getRepliesByCategoryId, getRepliesByTopicId, getReplyById,
  deleteReplyById, getRepliesByAuthorId, getRepliesByUserId, getRepliesByCommentId,
  updateReplyById, replyHasReplies, hideReplyById, getParentComment, getReplyEditHistory,
  getReplyContext, getLikedCommentsByUserId } from '../repositories/reply.repository.js';
import { getLikesPrivacyById } from '../repositories/user.repository.js';
import { createNotification } from '../repositories/notification.repository.js';
import { createAttachment, getAttachmentsByContenidoId, getAttachmentsForDeletion } from '../repositories/adjunto.repository.js';
import { uploadAttachment, deleteAttachmentFromCloudinary } from '../utils/uploadToCloudinary.js';
import pool from '../config/db.js';

const createReplyService = async (autorId, { cuerpo, tema_id, categoria_id, comentario_padre_id }, files = []) => {
  const cuerpoLimpio = cuerpo?.trim() || '';

  // Un comentario puede ir sin texto si lleva al menos un adjunto (imagen/archivo).
  if (!cuerpoLimpio && files.length === 0) {
    const err = new Error('El comentario no puede estar vacío');
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

  if (cuerpoLimpio.length > 5000) {
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
    cuerpo: cuerpoLimpio,
    tema_id: tema_id || null,
    categoria_id: categoria_id || null,
    comentario_padre_id: comentario_padre_id || null
  });

  // Notificar al autor del comentario padre que recibió una respuesta.
  // Cada respuesta es un evento único (sin dedup). Nunca a uno mismo.
  if (comentario_padre_id && padre && padre.autor_id !== autorId) {
    const url = padre.tema_id
      ? `/topic/${padre.tema_id}?commentId=${created.contenido_id}`
      : padre.categoria_id
        ? `/category/${padre.categoria_id}?tab=comentarios&commentId=${created.contenido_id}`
        : null;
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

  // Notificaciones para comentarios de primer nivel (no respuestas a otro
  // comentario). Cada comentario es un evento único: sin dedup, nunca a uno mismo.
  if (!comentario_padre_id) {
    const { rows } = await pool.query('SELECT nickname FROM usuario WHERE id = $1', [autorId]);
    const nick = rows[0]?.nickname;

    if (tema_id) {
      // Comentario en un tema → al autor del tema y al autor de la categoría.
      // Ambos clicks llevan al comentario dentro del tema.
      const topic = await getTopicById(tema_id);
      const urlTema = `/topic/${tema_id}?commentId=${created.contenido_id}`;

      if (topic && topic.autor_id !== autorId) {
        await createNotification({
          usuario_id: topic.autor_id,
          tipo: 'comentario_en_tema',
          mensaje: `${nick} comentó en tu tema ${topic.titulo}`,
          contenido_id: created.contenido_id,
          actor_id: autorId,
          url: urlTema,
        });
      }

      // Autor de la categoría: solo si es distinto del comentarista y del autor
      // del tema (para no duplicarle la notificación a la misma persona).
      const cat = topic ? await getCategoryById(topic.categoria_id) : null;
      if (cat && cat.autor_id !== autorId && cat.autor_id !== topic.autor_id) {
        await createNotification({
          usuario_id: cat.autor_id,
          tipo: 'comentario_en_tema_categoria',
          mensaje: `${nick} comentó en un tema de tu categoría ${cat.titulo}`,
          contenido_id: created.contenido_id,
          actor_id: autorId,
          url: urlTema,
        });
      }
    } else if (categoria_id) {
      // Comentario directo en la categoría → al autor de la categoría.
      const cat = await getCategoryById(categoria_id);
      if (cat && cat.autor_id !== autorId) {
        await createNotification({
          usuario_id: cat.autor_id,
          tipo: 'comentario_en_categoria',
          mensaje: `${nick} comentó en tu categoría ${cat.titulo}`,
          contenido_id: created.contenido_id,
          actor_id: autorId,
          url: `/category/${categoria_id}?tab=comentarios&commentId=${created.contenido_id}`,
        });
      }

      // Suscriptores de la categoría (campanita), excepto el actor y el autor
      // (que ya recibió la suya). Solo aplica a comentarios directos de 1er nivel.
      if (cat) {
        const url = `/category/${categoria_id}?tab=comentarios&commentId=${created.contenido_id}`;
        const subs = await getCategorySubscribers(categoria_id, [autorId, cat.autor_id]);
        for (const subId of subs) {
          await createNotification({
            usuario_id: subId,
            tipo: 'comentario_categoria_seguida',
            mensaje: `${nick} publicó un comentario en ${cat.titulo}`,
            contenido_id: created.contenido_id,
            actor_id: autorId,
            url,
          });
        }
      }
    }
  }

  // Adjuntos: subir a Cloudinary (en paralelo, que es la parte lenta) e insertar
  // en la tabla `adjunto` respetando el orden de selección.
  if (files.length > 0) {
    const subidos = await Promise.all(
      files.map((f) => uploadAttachment(f.buffer, f.tipo, f.originalname))
    );
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const { url, public_id } = subidos[i];
      await createAttachment({
        contenidoId: created.contenido_id,
        url,
        publicId: public_id,
        nombreOriginal: f.originalname,
        tipo: f.tipo,
        tamano: f.size,
      });
    }
    created.adjuntos = await getAttachmentsByContenidoId(created.contenido_id);
  } else {
    created.adjuntos = [];
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

// Borra de Cloudinary los adjuntos de un comentario antes de eliminar su fila
// (las filas de `adjunto` se van por cascade; los archivos no).
async function deleteCommentAttachments(contenidoId) {
  const adjuntos = await getAttachmentsForDeletion(contenidoId);
  for (const a of adjuntos) {
    await deleteAttachmentFromCloudinary(a.public_id, a.tipo);
  }
}

async function cleanupOrphanedParents(commentId) {
  const hasReplies = await replyHasReplies(commentId);
  if (hasReplies) return; // todavía tiene otras respuestas, no borrar

  const parentInfo = await getParentComment(commentId);
  await deleteCommentAttachments(commentId);
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

  // Borrar los adjuntos de Cloudinary (las filas se van por cascade al borrar
  // el contenido). replyId es el contenido_id del comentario.
  await deleteCommentAttachments(replyId);

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

const getRepliesByUserIdService = async (userId, viewerId = null) => {
  return await getRepliesByUserId(userId, viewerId);
};

const getLikedCommentsByUserIdService = async (userId, viewerId = null) => {
  // Si el dueño tiene los "me gusta" privados, solo él puede ver la lista.
  // El resto recibe FORBIDDEN (el frontend muestra el placeholder).
  const privacy = await getLikesPrivacyById(userId);
  if (privacy?.me_gusta_privado && Number(viewerId) !== Number(userId)) {
    const err = new Error('Este usuario tiene sus me gusta privados');
    err.code = 'FORBIDDEN';
    throw err;
  }
  return await getLikedCommentsByUserId(userId, viewerId);
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

const getReplyContextService = async (commentId, userId = null) => {
  const id = Number(commentId);
  if (!Number.isInteger(id) || id < 1) {
    const err = new Error('ID inválido');
    err.code = 'BAD_REQUEST';
    throw err;
  }
  const chain = await getReplyContext(commentId, userId);
  if (chain.length === 0) {
    const err = new Error('Comentario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }
  return chain;
};

export { createReplyService, getRepliesByCategoryIdService, getRepliesByTopicIdService,
  deleteReplyService, getMyRepliesService, getRepliesByUserIdService, updateReplyService,
  getReplyByIdService, getRepliesByCommentIdService, getReplyEditHistoryService,
  getReplyContextService, getLikedCommentsByUserIdService };