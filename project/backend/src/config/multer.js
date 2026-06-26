import multer from 'multer';

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

// Adjuntos de comentarios: hasta 3 archivos, 10 MB c/u. El tipo real se valida
// por magic numbers en el controller (no por mimetype, que es spoofeable).
export const uploadAttachments = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 3 },
});