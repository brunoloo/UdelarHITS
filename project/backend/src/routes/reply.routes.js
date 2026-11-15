import { Router } from 'express';
import { createReply, getRepliesByCategory, getRepliesByTopic, deleteReply,
    getMyReplies, getRepliesByUser, updateReply, getReplyById, getRepliesByComment, getReplyEditHistory,
    getReplyContext, getLikedReplies, getRecentReplies, getTrendingThread,
    pinHomeComment, unpinHomeComment } from '../controllers/reply.controller.js';
import { protect, isAdmin, optionalAuth } from '../middlewares/auth.middleware.js';
import { uploadAttachments } from '../config/multer.js';

const router = Router();

const handleAttachments = (req, res, next) => {
  uploadAttachments.array('archivos', 3)(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ ok: false, message: 'Cada archivo debe pesar máximo 10 MB' });
      }
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({ ok: false, message: 'Máximo 3 archivos por comentario' });
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