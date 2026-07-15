import cloudinary from '../config/cloudinary.js';

// Defensa 4: distinguir el rechazo por cuota/límite del plan de Cloudinary de
// otros errores (archivo inválido, red, etc.). Cloudinary señala los límites
// con http_code 420 (rate limit) o mensajes que refieren a quota/plan/limit.
export const isCloudinaryQuotaError = (error) =>
  error?.http_code === 420 ||
  /quota|rate ?limit|usage limit|plan.{0,20}limit|limit.{0,20}(exceeded|reached)|credits/i
    .test(error?.message || '');

// Envuelve el error crudo de Cloudinary: si es de cuota, sale con código
// propio para que los controllers respondan 503 con un mensaje honesto en vez
// de un 500 genérico.
const wrapCloudinaryError = (error) => {
  if (isCloudinaryQuotaError(error)) {
    const err = new Error('Almacenamiento temporalmente no disponible (cuota del proveedor superada)');
    err.code = 'CLOUDINARY_QUOTA';
    return err;
  }
  return error;
};

const AVATARS_FOLDER = 'udelarhits/avatars';

// Tamaños que pide el frontend para los avatares (ver avatarThumbnail /
// AVATAR_BUCKETS en frontend/src/utils/cloudinaryUrl.js): 96 cubre TODOS los
// avatares chicos (chat, listas, header, comentarios); 192, el del perfil.
// Mantener en sync con esos buckets.
const AVATAR_PREWARM_SIZES = [96, 192];

// Pre-genera ("pre-warm") las miniaturas de un avatar recién subido para que
// Cloudinary las tenga listas en su CDN antes de que alguien las pida. Esa
// primera derivación on-the-fly es lo que hacía que la foto tardara o no
// cargara en el chat. Best-effort: fire-and-forget, nunca bloquea ni rompe la
// subida (el avatar ya quedó guardado). Solo avatares.
const prewarmAvatarThumbnails = (secureUrl) => {
  if (process.env.NODE_ENV === 'test') return;
  if (typeof fetch !== 'function' || !secureUrl?.includes('/upload/')) return;
  for (const px of AVATAR_PREWARM_SIZES) {
    const thumbUrl = secureUrl.replace(
      '/upload/',
      `/upload/c_fill,w_${px},h_${px},f_auto,q_auto/`
    );
    // Con f_auto, Cloudinary genera un derivado DISTINTO por formato según el
    // Accept del cliente. Sin este header pre-generaríamos una variante (JP/PNG)
    // que el navegador no pide, y la de AVIF/WebP se generaría igual on-the-fly.
    // Avisamos los formatos modernos para pre-generar justo esa variante.
    fetch(thumbUrl, { headers: { Accept: 'image/avif,image/webp,image/*,*/*' } })
      .catch(() => {});
  }
};

export const uploadToCloudinary = async (buffer, folder, publicId) => {
  if (process.env.NODE_ENV === 'test') {
    return 'https://res.cloudinary.com/test/image/upload/fake.jpg';
  }
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        overwrite: true,
        resource_type: 'image'
      },
      (error, result) => {
        if (error) reject(wrapCloudinaryError(error));
        else {
          // Solo avatares (misma función sube banners): los banners se muestran
          // una vez, en el perfil, y no usan thumbnail cuadrado.
          if (folder === AVATARS_FOLDER) prewarmAvatarThumbnails(result.secure_url);
          resolve(result.secure_url);
        }
      }
    );
    stream.end(buffer);
  });
};

export const deleteFromCloudinary = async (folder, publicId) => {
  if (process.env.NODE_ENV === 'test') {
    return { result: 'ok' };
  }
  try {
    return await cloudinary.uploader.destroy(
      `${folder}/${publicId}`,
      { resource_type: 'image' }
    );
  } catch (err) {
    return { result: 'error', error: err?.message };
  }
};

// Mueve/renombra un asset de imagen ya subido a otro public_id, SIN re-subir el
// buffer. Se usa al aprobar un avatar/banner que estaba en revisión: pasa de la
// carpeta de pendientes a la canónica (avatars/banners), así el borrado
// posterior (deleteFromCloudinary con el id canónico) lo encuentra y no quedan
// archivos huérfanos ocupando espacio. Devuelve la nueva secure_url.
export const renameCloudinaryImage = async (fromPublicId, toPublicId) => {
  if (process.env.NODE_ENV === 'test') {
    return `https://res.cloudinary.com/test/image/upload/${toPublicId}.jpg`;
  }
  const result = await cloudinary.uploader.rename(fromPublicId, toPublicId, {
    overwrite: true,
    invalidate: true,
    resource_type: 'image',
  });
  return result.secure_url;
};

// Inserta la optimización de entrega (f_auto,q_auto) en la URL de una imagen, así
// Cloudinary sirve el mejor formato/calidad sin tocar parámetros de subida (que es
// lo que rompía el upload de imágenes, p. ej. .webp → 500).
const optimizeImageUrl = (url) =>
  url.includes('/image/upload/')
    ? url.replace('/image/upload/', '/image/upload/f_auto,q_auto/')
    : url;

// Genera un public_id para documentos que conserva el nombre y la extensión
// original (sanitizados). Para 'raw', el public_id ES el nombre del archivo en la
// URL: sin extensión, el navegador descarga algo "sin formato" (parece sospechoso).
const documentPublicId = (originalname = '') => {
  const dot = originalname.lastIndexOf('.');
  const rawBase = dot > 0 ? originalname.slice(0, dot) : originalname;
  const ext = dot > 0 ? originalname.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const safeBase = (rawBase || 'archivo').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 8);
  return ext ? `${safeBase}_${suffix}.${ext}` : `${safeBase}_${suffix}`;
};

// URL de entrega para documentos: firmada (sign_url) + fl_attachment. Cloudinary
// bloquea por defecto la entrega de PDF y ZIP por seguridad; las URLs firmadas SÍ
// se permiten para esos tipos. fl_attachment fuerza la descarga (Content-Disposition:
// attachment), evitando que el visor del navegador intente renderizar el PDF y falle.
const signedDocumentUrl = (publicId, version) =>
  cloudinary.url(publicId, {
    resource_type: 'raw',
    type: 'upload',
    secure: true,
    sign_url: true,
    flags: 'attachment',
    ...(version ? { version } : {}),
  });

// Sube un adjunto de comentario. Imágenes como 'image', documentos como 'raw'.
// Devuelve { url, public_id } (public_id para borrarlo luego).
export const uploadAttachment = async (buffer, tipo, originalname = '') => {
  const isImage = tipo === 'imagen';
  if (process.env.NODE_ENV === 'test') {
    return {
      url: `https://res.cloudinary.com/test/${isImage ? 'image' : 'raw'}/upload/fake_${Math.random().toString(36).slice(2)}`,
      public_id: `udelarhits/adjuntos/fake_${Math.random().toString(36).slice(2)}`,
    };
  }
  return new Promise((resolve, reject) => {
    const options = { folder: 'udelarhits/adjuntos', resource_type: isImage ? 'image' : 'raw' };
    if (!isImage) options.public_id = documentPublicId(originalname);
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) reject(wrapCloudinaryError(error));
      else resolve({
        url: isImage ? optimizeImageUrl(result.secure_url) : signedDocumentUrl(result.public_id, result.version),
        public_id: result.public_id,
      });
    });
    stream.end(buffer);
  });
};

// Borra un adjunto de Cloudinary por su public_id completo y resource_type.
export const deleteAttachmentFromCloudinary = async (publicId, tipo) => {
  if (process.env.NODE_ENV === 'test') {
    return { result: 'ok' };
  }
  try {
    return await cloudinary.uploader.destroy(publicId, {
      resource_type: tipo === 'imagen' ? 'image' : 'raw',
    });
  } catch (err) {
    return { result: 'error', error: err?.message };
  }
};

