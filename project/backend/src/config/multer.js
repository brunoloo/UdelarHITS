import multer from 'multer';
import { ATTACHMENT_LIMITS } from './attachmentRules.js';

const storage = multer.memoryStorage();

const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const fileFilter = (req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Solo se permiten imágenes'));
  }
};

export const uploadAvatar = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter
});

export const uploadBanner = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
  fileFilter
});

// El tipo real se valida por contenido en el controller.
// Los navegadores mandan el nombre en UTF-8; multer lo lee como latin1 por defecto.
export const uploadAttachments = multer({
  storage,
  defParamCharset: 'utf8',
  limits: { fileSize: ATTACHMENT_LIMITS.MAX_TAMANO, files: ATTACHMENT_LIMITS.MAX_ARCHIVOS },
});