import { Router } from 'express';
import { createReply, getRepliesByCategory, getRepliesByTopic, deleteReply, 
    getMyReplies, getRepliesByUser, updateReply, getReplyById, getRepliesByComment, getReplyEditHistory } from '../controllers/reply.controller.js';
import { protect, isAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/create', protect, createReply);                        // Publicar comentario

router.get('/me', protect, getMyReplies);                            // Listar mis comentarios

router.get('/:id/history', getReplyEditHistory);                     // Obtener historial de edición

router.get('/:id', getReplyById);                                    // Listar comentarios dado un id

router.get('/:id/replies', getRepliesByComment);                     // Listar comentarios de un comentario dado un id

router.get('/user/:userId', protect, getRepliesByUser);              // Obtener respuestas de usuario         

router.patch('/update/:id', protect, updateReply);                   // Editar comentario 

router.delete('/delete/:id', protect, deleteReply);                  // Eliminar comentario

router.get('/category/:categoriaId', getRepliesByCategory);          // Obtener los comentarios de una categoría
router.get('/topic/:topicId', getRepliesByTopic);                    // Obtener los comentarios de un tema dentro de una categoría


export default router;