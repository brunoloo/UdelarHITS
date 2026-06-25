import { Router } from 'express';
import { createReply, getRepliesByCategory, getRepliesByTopic, deleteReply,
    getMyReplies, getRepliesByUser, updateReply, getReplyById, getRepliesByComment, getReplyEditHistory,
    getReplyContext, getLikedReplies } from '../controllers/reply.controller.js';
import { protect, isAdmin, optionalAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/create', protect, createReply);                        // Publicar comentario

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