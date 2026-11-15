import cloudinary from '../config/cloudinary.js';

// El proveedor señala los límites del plan con http_code 420 o con mensajes de cuota.
export const isCloudinaryQuotaError = (error) =>
  error?.http_code === 420 ||
  /quota|rate ?limit|usage limit|plan.{0,20}limit|limit.{0,20}(exceeded|reached)|credits/i
    .test(error?.message || '');

// Un error de cuota sale con código propio para responder 503 en vez de 500.
const wrapCloudinaryError = (error) => {
  if (isCloudinaryQuotaError(error)) {
    const err = new Error('Almacenamiento temporalmente no disponible (cuota del proveedor superada)');
    err.code = 'CLOUDINARY_QUOTA';
    return err;
  }
  return error;
};

const AVATARS_FOLDER = 'udelarhits/avatars';

// Tamaños que pide el frontend (AVATAR_BUCKETS en frontend/src/utils/cloudinaryUrl.js).
// Mantener en sync.
const AVATAR_PREWARM_SIZES = [96, 192];

// Pide las miniaturas de un avatar recién subido para que ya estén generadas cuando
// alguien las solicite. No bloquea la subida.
const prewarmAvatarThumbnails = (secureUrl) => {
  if (process.env.NODE_ENV === 'test') return;
  if (typeof fetch !== 'function' || !secureUrl?.includes('/upload/')) return;
  for (const px of AVATAR_PREWARM_SIZES) {
    const thumbUrl = secureUrl.replace(
      '/upload/',
      `/upload/c_fill,w_${px},h_${px},f_auto,q_auto/`
    );
    // El derivado depende del Accept del cliente: se piden los formatos modernos, que son
    // los que usa el navegador.
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
          // Solo avatares: los banners no usan miniatura cuadrada.
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

// Mueve una imagen ya subida sin volver a subirla.
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

// Optimización de entrega en la URL, sin tocar los parámetros de subida.
const optimizeImageUrl = (url) =>
  url.includes('/image/upload/')
    ? url.replace('/image/upload/', '/image/upload/f_auto,q_auto/')
    : url;

// El public_id es el nombre del archivo en la URL: conserva nombre y extensión, sanitizados.
const documentPublicId = (originalname = '') => {
  const dot = originalname.lastIndexOf('.');
  const rawBase = dot > 0 ? originalname.slice(0, dot) : originalname;
  const ext = dot > 0 ? originalname.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const safeBase = (rawBase || 'archivo').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
  const suffix = Math.random().toString(36).slice(2, 8);
  return ext ? `${safeBase}_${suffix}.${ext}` : `${safeBase}_${suffix}`;
};

// URL firmada con descarga forzada: la entrega de PDF y ZIP sin firma está bloqueada por defecto.
const signedDocumentUrl = (publicId, version) =>
  cloudinary.url(publicId, {
    resource_type: 'raw',
    type: 'upload',
    secure: true,
    sign_url: true,
    flags: 'attachment',
    ...(version ? { version } : {}),
  });

// Imágenes como 'image' y documentos como 'raw'.
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

