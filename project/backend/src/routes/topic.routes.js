import { Router } from 'express';
import { createTopic, getTopics, getTopicById, getMyTopics, 
    updateTopic, deleteTopic, activeTopic,  getTopicsByCategory, getTopicsByUser } from '../controllers/topic.controller.js';
import { protect, isAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', protect, isAdmin, getTopics);        // Listar temas (solo admin)
router.post('/create', protect, createTopic);        // Crear un tema 
router.get('/me', protect, getMyTopics);             // Ver mis temas

router.patch('/:id', protect, updateTopic);          // Actualizar tema
router.get('/:id', getTopicById);          // Ver temas por id

router.get('/user/:userId', protect, getTopicsByUser);

router.get('/category/:categoriaId', getTopicsByCategory);

router.patch('/:id/delete', protect, deleteTopic);    // Desactivar tema
router.patch('/:id/active', protect, activeTopic);    // Activar tema

export default router;