import { getTopicById, hardDeleteTopicById, topicHasContent } from '../repositories/topic.repository.js';
import {getCategoryById ,assignParticipantRole, categoryHasContent, hardDeleteCategoryById, getCategorySubscribers } from '../repositories/category.repository.js';


import { createReply, getRepliesByCategoryId, getRepliesByTopicId, getReplyById,
  deleteReplyById, getRepliesByAuthorId, getRepliesByUserId, getRepliesByCommentId,
  updateReplyById, replyHasReplies, hideReplyById, getParentComment, getReplyEditHistory,
  getReplyContext, getLikedCommentsByUserId } from '../repositories/reply.repository.js';
import { getLikesPrivacyById } from '../repositories/user.repository.js';
import { canViewUserContent } from './access.service.js';
import { isBlocked } from '../repositories/block.repository.js';
import { createNotification } from '../repositories/notification.repository.js';
import { createAttachment, getAttachmentsByContenidoId, getAttachmentsForDeletion } from '../repositories/adjunto.repository.js';
import { createPoll, getPollByContenidoId } from '../repositories/encuesta.repository.js';
import { uploadAttachment, deleteAttachmentFromCloudinary } from '../utils/uploadToCloudinary.js';
import pool from '../config/db.js';

const ENCUESTA_DUR_MIN = 60;            // 1 minuto
const ENCUESTA_DUR_MAX = 7 * 24 * 3600; // 1 semana

// Valida y normaliza la encuesta recibida del cliente. Devuelve { opciones,
// duracionSegundos } o lanza BAD_REQUEST. null si no hay encuesta.
const validarEncuesta = (encuesta) => {
  if (encuesta == null) return null;
  const bad = (msg) => { const e = new Error(msg); e.code = 'BAD_REQUEST'; throw e; };

  const opciones = (Array.isArray(encuesta.opciones) ? encuesta.opciones : [])
    .map((o) => (typeof o === 'string' ? o.trim() : ''))
    .filter((o) => o.length > 0);
  if (opciones.length < 2 || opciones.length > 5) bad('La encuesta debe tener entre 2 y 5 opciones');
  if (opciones.some((o) => o.length > 80)) bad('Cada opción de la encuesta admite hasta 80 caracteres');

  const dur = Number(encuesta.duracion_segundos);
  if (!Number.isFinite(dur) || dur < ENCUESTA_DUR_MIN || dur > ENCUESTA_DUR_MAX) {
    bad('La duración de la encuesta debe ser entre 1 minuto y 1 semana');
  }
  return { opciones, duracionSegundos: Math.floor(dur) };
};

const createReplyService = async (autorId, { cuerpo, tema_id, categoria_id, comentario_padre_id, encuesta }, files = []) => {
  const cuerpoLimpio = cuerpo?.trim() || '';
  const encuestaValidada = validarEncuesta(encuesta);

  // Un comentario puede ir sin texto si lleva al menos un adjunto o una encuesta.
  if (!cuerpoLimpio && files.length === 0 && !encuestaValidada) {
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
    if (await isBlocked(autorId, padre.autor_id)) {
      const err = new Error('No se puede realizar esta acción');
      err.code = 'FORBIDDEN';
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

      if (topic && topic.autor_id !== autorId && !(await isBlocked(autorId, topic.autor_id))) {
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
      if (cat && cat.autor_id !== autorId && cat.autor_id !== topic.autor_id && !(await isBlocked(autorId, cat.autor_id))) {
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
      if (cat && cat.autor_id !== autorId && !(await isBlocked(autorId, cat.autor_id))) {
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

  // Menciones (@nickname): notificar a cada usuario mencionado, sin duplicar
  // al autor ni a usuarios que ya recibieron notificación por otro motivo.
  if (cuerpoLimpio) {
    const mentionRegex = /@(\w[\w.-]{0,29})/g
    const mentionedNicks = [...new Set(
      Array.from(cuerpoLimpio.matchAll(mentionRegex), m => m[1].toLowerCase())
    )];
    if (mentionedNicks.length > 0) {
      const { rows: nickRows } = await pool.query('SELECT nickname FROM usuario WHERE id = $1', [autorId]);
      const actorNick = nickRows[0]?.nickname;
      const placeholders = mentionedNicks.map((_, i) => `$${i + 1}`).join(', ');
      const { rows: mentionedUsers } = await pool.query(
        `SELECT id, nickname FROM usuario WHERE estado = 'activo' AND LOWER(nickname) IN (${placeholders})`,
        mentionedNicks
      );

      const alreadyNotified = new Set();
      alreadyNotified.add(autorId);
      if (comentario_padre_id && padre) alreadyNotified.add(padre.autor_id);

      const commentUrl = created.tema_id
        ? `/topic/${created.tema_id}?commentId=${created.contenido_id}`
        : created.categoria_id
          ? `/category/${created.categoria_id}?tab=comentarios&commentId=${created.contenido_id}`
          : null;

      for (const mu of mentionedUsers) {
        if (alreadyNotified.has(mu.id)) continue;
        alreadyNotified.add(mu.id);
        // No notificar menciones a través de un bloqueo (en cualquier dirección).
        if (await isBlocked(autorId, mu.id)) continue;
        await createNotification({
          usuario_id: mu.id,
          tipo: 'mencion_comentario',
          mensaje: `${actorNick} te mencionó en un comentario`,
          contenido_id: created.contenido_id,
          actor_id: autorId,
          url: commentUrl,
        });
      }
    }
  }

  // Adjuntos: subir a Cloudinary (en paralelo, que es la parte lenta) e insertar
  // en la tabla `adjunto` respetando el orden de selección.
  //
  // allSettled y no all: a esta altura el comentario YA está creado, así que un
  // fallo de subida (p. ej. cuota de Cloudinary superada) nunca debe tirar la
  // request entera — se conservan los adjuntos que sí subieron y se devuelve
  // una advertencia honesta para que el usuario sepa qué pasó.
  if (files.length > 0) {
    const resultados = await Promise.allSettled(
      files.map((f) => uploadAttachment(f.buffer, f.tipo, f.originalname))
    );
    let falloCuota = false;
    let falloOtro = false;
    for (let i = 0; i < files.length; i++) {
      const r = resultados[i];
      if (r.status !== 'fulfilled') {
        if (r.reason?.code === 'CLOUDINARY_QUOTA') falloCuota = true;
        else falloOtro = true;
        continue;
      }
      const f = files[i];
      const { url, public_id } = r.value;
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
    if (falloCuota) {
      created.advertencia = 'Tu comentario se publicó, pero los archivos no se pudieron subir por un problema temporal de almacenamiento del sitio — no es un error tuyo. Probá adjuntarlos de nuevo más tarde.';
    } else if (falloOtro) {
      created.advertencia = 'Tu comentario se publicó, pero algunos archivos no se pudieron subir. Probá adjuntarlos de nuevo más tarde.';
    }
  } else {
    created.adjuntos = [];
  }

  // Encuesta: crear la encuesta y sus opciones; fecha_cierre = ahora + duración.
  if (encuestaValidada) {
    const fechaCierre = new Date(Date.now() + encuestaValidada.duracionSegundos * 1000);
    await createPoll({
      contenidoId: created.contenido_id,
      fechaCierre,
      opciones: encuestaValidada.opciones,
    });
    created.encuesta = await getPollByContenidoId(created.contenido_id, autorId);
  } else {
    created.encuesta = null;
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

const getRepliesByUserIdService = async (userId, viewerId = null, viewerRol = null) => {
  // Gating de privacidad en el backend: los comentarios de una cuenta privada
  // solo los ve el dueño, un admin o un seguidor aceptado.
  const allowed = await canViewUserContent(userId, viewerId, viewerRol);
  if (!allowed) {
    const err = new Error('Esta cuenta es privada');
    err.code = 'FORBIDDEN';
    throw err;
  }
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

  if (cuerpo.trim().length > 5000) {
    const err = new Error('El comentario superó el máximo de 5000 caracteres');
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