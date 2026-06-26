import { Router } from 'express';
import { createReply, getRepliesByCategory, getRepliesByTopic, deleteReply,
    getMyReplies, getRepliesByUser, updateReply, getReplyById, getRepliesByComment, getReplyEditHistory,
    getReplyContext, getLikedReplies } from '../controllers/reply.controller.js';
import { protect, isAdmin, optionalAuth } from '../middlewares/auth.middleware.js';
import { uploadAttachments } from '../config/multer.js';

const router = Router();

// Recibe hasta 3 adjuntos en el campo `archivos`. Traduce errores de multer
// (tamaño/cantidad) a 400 con mensaje claro.
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

router.post('/create', protect, handleAttachments, createReply);     // Publicar comentario (con adjuntos)

router.get('/me', protect, getMyReplies);                            // Listar mis comentarios

router.get('/:id/history', getReplyEditHistory);                     // Obtener historial de edición

router.get('/:id/context', optionalAuth, getReplyContext);            // Cadena de ancestros de un comentario

router.get('/:id', getReplyById);                                    // Listar comentarios dado un id

router.get('/:id/replies', optionalAuth, getRepliesByComment);       // Listar comentarios de un comentario dado un id

router.get('/user/:userId', protect, getRepliesByUser);              // Obtener respuestas de usuario

router.get('/liked/:userId', protect, getLikedReplies);              // Comentarios a los que el usuario dio me gusta

router.patch('/update/:id', protect, updateReply);                   // Editar comentario 

router.delete('/delete/:id', protect, deleteReply);                  // Eliminar comentario

router.get('/category/:categoriaId', optionalAuth, getRepliesByCategory);  // Obtener los comentarios de una categoría
router.get('/topic/:topicId', optionalAuth, getRepliesByTopic);            // Obtener los comentarios de un tema dentro de una categoría


export default router;