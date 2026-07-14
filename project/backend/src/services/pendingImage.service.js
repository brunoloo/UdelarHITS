import { deleteAttachmentFromCloudinary } from '../utils/uploadToCloudinary.js';
import { createNotification } from '../repositories/notification.repository.js';
import {
  listPendingAdjuntos, listPendingImagenes,
  getPendingAdjunto, getPendingImagen,
  approveAdjunto, markAdjuntoRejected,
  promotePendingImagen, deletePendingImagen,
  getExpiredPendingAdjuntos, getExpiredPendingImagenes,
} from '../repositories/pendingImage.repository.js';

// Mensaje genérico de rechazo: NO expone scores ni detalles de por qué.
const REJECTION_MESSAGE = 'Tu imagen fue rechazada por no cumplir con las normas de la comunidad.';

// Notificación in-app (sin email, no gastar cuota de Resend).
const notifyRejection = (usuarioId, contenidoId = null) =>
  createNotification({
    usuario_id: usuarioId,
    tipo: 'moderacion_imagen',
    mensaje: REJECTION_MESSAGE,
    contenido_id: contenidoId,
  });

const notFound = (msg) => {
  const err = new Error(msg);
  err.code = 'NOT_FOUND';
  return err;
};

// Contexto legible + link para un adjunto pendiente (según sea de tema o categoría).
const buildAdjuntoContext = (row) => {
  if (row.tema_id) return { contexto: `Adjunto en "${row.tema_titulo}"`, link: `/topic/${row.tema_id}` };
  if (row.categoria_id) return { contexto: `Adjunto en ${row.categoria_titulo}`, link: `/category/${row.categoria_id}` };
  return { contexto: 'Adjunto en un comentario', link: null };
};

// --- Listado unificado (cola del admin) -----------------------------------
const listPendingImagesService = async () => {
  const [adjuntos, imagenes] = await Promise.all([
    listPendingAdjuntos(),
    listPendingImagenes(),
  ]);

  const items = [
    ...adjuntos.map((a) => {
      const { contexto, link } = buildAdjuntoContext(a);
      return {
        id: a.id,
        origen: 'adjunto',
        url: a.url,
        autor_nickname: a.autor_nickname,
        contexto,
        link,
        score_adult: a.score_adult,
        score_racy: a.score_racy,
        fecha_creacion: a.fecha_creacion,
      };
    }),
    ...imagenes.map((ip) => ({
      id: ip.id,
      origen: ip.tipo, // 'avatar' | 'banner'
      url: ip.url,
      autor_nickname: ip.autor_nickname,
      contexto: ip.tipo === 'avatar' ? `Avatar de @${ip.autor_nickname}` : `Banner de @${ip.autor_nickname}`,
      link: `/user/${ip.autor_nickname}`,
      score_adult: ip.score_adult,
      score_racy: ip.score_racy,
      fecha_creacion: ip.fecha_creacion,
    })),
  ];

  // Cola: las más viejas primero.
  items.sort((a, b) => new Date(a.fecha_creacion) - new Date(b.fecha_creacion));
  return items;
};

// --- Aprobar ---------------------------------------------------------------
const approvePendingImageService = async (id, origen) => {
  if (origen === 'adjunto') {
    const ok = await approveAdjunto(id);
    if (!ok) throw notFound('Adjunto no encontrado o ya resuelto');
    return { action: 'adjunto_aprobado' };
  }
  // avatar | banner: promover la imagen a la columna de `usuario` y borrar la fila.
  const promoted = await promotePendingImagen(id);
  if (!promoted) throw notFound('Imagen pendiente no encontrada');
  return { action: `${origen}_aprobado` };
};

// --- Rechazar (helpers compartidos con el auto-descarte) -------------------
const rejectAdjuntoById = async (id) => {
  const row = await getPendingAdjunto(id);
  if (!row || row.estado !== 'pendiente_revision') throw notFound('Adjunto no encontrado o ya resuelto');
  await deleteAttachmentFromCloudinary(row.public_id, row.tipo);
  await markAdjuntoRejected(id);
  await notifyRejection(row.autor_id, row.contenido_id);
};

const rejectImagenPendienteById = async (id) => {
  const row = await getPendingImagen(id);
  if (!row) throw notFound('Imagen pendiente no encontrada');
  await deleteAttachmentFromCloudinary(row.public_id, 'imagen');
  await deletePendingImagen(id);
  await notifyRejection(row.usuario_id, null);
};

const rejectPendingImageService = async (id, origen) => {
  if (origen === 'adjunto') {
    await rejectAdjuntoById(id);
    return { action: 'adjunto_rechazado' };
  }
  await rejectImagenPendienteById(id);
  return { action: `${origen}_rechazado` };
};

// --- Auto-descarte a las N horas (lo llama el job de limpieza) -------------
const expiryHours = () => Number(process.env.IMAGE_REVIEW_EXPIRY_HOURS || 48);

const purgeExpiredPendingImages = async (hours = expiryHours()) => {
  const [adjuntos, imagenes] = await Promise.all([
    getExpiredPendingAdjuntos(hours),
    getExpiredPendingImagenes(hours),
  ]);

  for (const a of adjuntos) {
    await deleteAttachmentFromCloudinary(a.public_id, a.tipo);
    await markAdjuntoRejected(a.id);
    await notifyRejection(a.autor_id, a.contenido_id);
  }
  for (const ip of imagenes) {
    await deleteAttachmentFromCloudinary(ip.public_id, 'imagen');
    await deletePendingImagen(ip.id);
    await notifyRejection(ip.usuario_id, null);
  }

  return { adjuntos: adjuntos.length, imagenes: imagenes.length };
};

export {
  listPendingImagesService,
  approvePendingImageService,
  rejectPendingImageService,
  purgeExpiredPendingImages,
};
