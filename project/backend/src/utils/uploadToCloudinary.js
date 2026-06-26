import cloudinary from '../config/cloudinary.js';

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
        if (error) reject(error);
        else resolve(result.secure_url);
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

// Inserta la optimización de entrega (f_auto,q_auto) en la URL de una imagen, así
// Cloudinary sirve el mejor formato/calidad sin tocar parámetros de subida (que es
// lo que rompía el upload de imágenes, p. ej. .webp → 500).
const optimizeImageUrl = (url) =>
  url.includes('/image/upload/')
    ? url.replace('/image/upload/', '/image/upload/f_auto,q_auto/')
    : url;

// Sube un adjunto de comentario. Imágenes como 'image', documentos como 'raw'.
// Devuelve { url, public_id } (public_id para borrarlo luego).
export const uploadAttachment = async (buffer, tipo) => {
  const isImage = tipo === 'imagen';
  if (process.env.NODE_ENV === 'test') {
    return {
      url: `https://res.cloudinary.com/test/${isImage ? 'image' : 'raw'}/upload/fake_${Math.random().toString(36).slice(2)}`,
      public_id: `udelarhits/adjuntos/fake_${Math.random().toString(36).slice(2)}`,
    };
  }
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'udelarhits/adjuntos', resource_type: isImage ? 'image' : 'raw' },
      (error, result) => {
        if (error) reject(error);
        else resolve({
          url: isImage ? optimizeImageUrl(result.secure_url) : result.secure_url,
          public_id: result.public_id,
        });
      }
    );
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

