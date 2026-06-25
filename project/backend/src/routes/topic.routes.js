import { Router } from 'express';
import { createTopic, getTopics, getTopicById, getMyTopics,
    updateTopic, deleteTopic, activeTopic,  getTopicsByCategory, getTopicsByUser,
    getRecentTopicsList, getTrendingTopicItem, getTopicEditHistory,
    pinTopicComment, unpinTopicComment } from '../controllers/topic.controller.js';
import { protect, isAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', protect, isAdmin, getTopics);        // Listar temas (solo admin)
router.post('/create', protect, createTopic);        // Crear un tema 
router.get('/me', protect, getMyTopics);             // Ver mis temas
router.get('/recent', getRecentTopicsList);          // Temas recientes (público)

router.get('/trending', getTrendingTopicItem);       // Obtener el tema más popular

router.get('/:id/history', getTopicEditHistory);     // Obtener ediciones anteriores
router.patch('/:id', protect, updateTopic);          // Actualizar tema
router.get('/:id', getTopicById);                    // Ver temas por id

router.get('/user/:userId', protect, getTopicsByUser);

router.get('/category/:categoriaId', getTopicsByCategory);


router.delete('/:id/delete', protect, deleteTopic);   // Desactivar tema
router.patch('/:id/active', protect, activeTopic);    // Activar tema

router.post('/:id/pin', protect, pinTopicComment);    // Fijar comentario (moderador del tema)
router.delete('/:id/pin', protect, unpinTopicComment); // Desanclar comentario

export default router;