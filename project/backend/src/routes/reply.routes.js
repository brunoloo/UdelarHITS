import { Router } from 'express';
import { createReply, getRepliesByCategory, getRepliesByTopic, deleteReply,
    getMyReplies, getRepliesByUser, updateReply, getReplyById, getRepliesByComment, getReplyEditHistory,
    getReplyContext, getLikedReplies, getRecentReplies, getTrendingThread,
    pinHomeComment, unpinHomeComment } from '../controllers/reply.controller.js';
import { protect, isAdmin, optionalAuth } from '../middlewares/auth.middleware.js';
import { uploadAttachments } from '../config/multer.js';
import { ATTACHMENT_LIMITS, MENSAJES_ADJUNTOS } from '../config/attachmentRules.js';

const router = Router();

// Margen para los campos de texto y los separadores multipart.
const MARGEN_MULTIPART = 1024 * 1024;

const handleAttachments = (req, res, next) => {
  // Corta antes de cargar nada en memoria; sin Content-Length lo revisa el controller.
  if (Number(req.headers['content-length']) > ATTACHMENT_LIMITS.MAX_TOTAL + MARGEN_MULTIPART) {
    return res.status(400).json({ ok: false, message: MENSAJES_ADJUNTOS.TOTAL });
  }
  uploadAttachments.array('archivos', ATTACHMENT_LIMITS.MAX_ARCHIVOS)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ ok: false, message: MENSAJES_ADJUNTOS.TAMANO });
      }
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ ok: false, message: MENSAJES_ADJUNTOS.CANTIDAD });
      }
      return res.status(400).json({ ok: false, message: 'Error al subir los archivos' });
    }
    next();
  });
};

router.post('/create', protect, handleAttachments, createReply);

router.get('/me', protect, getMyReplies);

router.get('/recent', optionalAuth, getRecentReplies);

router.get('/trending', optionalAuth, getTrendingThread);

router.get('/:id/history', getReplyEditHistory);

router.get('/:id/context', optionalAuth, getReplyContext);

router.post('/:id/pin-home', protect, isAdmin, pinHomeComment);
router.delete('/:id/pin-home', protect, isAdmin, unpinHomeComment);

router.get('/:id', getReplyById);

router.get('/:id/replies', optionalAuth, getRepliesByComment);

router.get('/user/:userId', protect, getRepliesByUser);

router.get('/liked/:userId', protect, getLikedReplies);

router.patch('/update/:id', protect, updateReply);

router.delete('/delete/:id', protect, deleteReply);

router.get('/category/:categoriaId', optionalAuth, getRepliesByCategory);
router.get('/topic/:topicId', optionalAuth, getRepliesByTopic);


export default router;