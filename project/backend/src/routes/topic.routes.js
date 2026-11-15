import { Router } from 'express';
import { createTopic, getTopics, getTopicById, getMyTopics,
    updateTopic, deleteTopic, activeTopic,  getTopicsByCategory, getTopicsByUser,
    getRecentTopicsList, getTrendingTopicItem, getTopicEditHistory,
    pinTopicComment, unpinTopicComment } from '../controllers/topic.controller.js';
import { protect, isAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', protect, isAdmin, getTopics);
router.post('/create', protect, createTopic);
router.get('/me', protect, getMyTopics);
router.get('/recent', getRecentTopicsList);

router.get('/trending', getTrendingTopicItem);

router.get('/:id/history', getTopicEditHistory);
router.patch('/:id', protect, updateTopic);
router.get('/:id', getTopicById);

router.get('/user/:userId', protect, getTopicsByUser);

router.get('/category/:categoriaId', getTopicsByCategory);


router.delete('/:id/delete', protect, deleteTopic);
router.patch('/:id/active', protect, activeTopic);

router.post('/:id/pin', protect, pinTopicComment);
router.delete('/:id/pin', protect, unpinTopicComment);

export default router;