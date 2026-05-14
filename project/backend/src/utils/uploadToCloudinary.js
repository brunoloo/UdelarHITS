import cloudinary from '../config/cloudinary.js';

export const uploadToCloudinary = async (buffer, folder, publicId) => {
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
  try {
    // Si no existe, Cloudinary responde "not found" → lo ignoramos
    return await cloudinary.uploader.destroy(
      `${folder}/${publicId}`,
      { resource_type: 'image' }
    );
  } catch (err) {
    // No rompemos el flujo
    return { result: 'error', error: err?.message };
  }
};

