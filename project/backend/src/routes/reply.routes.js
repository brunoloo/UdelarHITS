import { Router } from 'express';
import { createReply, getRepliesByCategory, getRepliesByTopic, deleteReply, 
    getMyReplies, getRepliesByUser, updateReply } from '../controllers/reply.controller.js';
import { protect, isAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/create', protect, createReply);                        // Publicar comentario

router.get('/me', protect, getMyReplies);                            // Listar mis comentarios

router.get('/user/:userId', protect, getRepliesByUser);         

router.patch('/update/:id', protect, updateReply);                   // Editar comentario 

router.delete('/delete/:id', protect, deleteReply);                  // Eliminar comentario

router.get('/category/:categoriaId', protect, getRepliesByCategory); // Obtener los comentarios de una categoría
router.get('/topic/:topicId', protect, getRepliesByTopic);           // Obtener los comentarios de un tema dentro de una categoría


export default router;