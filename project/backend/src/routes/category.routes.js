import { Router } from 'express';
import { createCategory, getCategories, getCategoryById, deleteCategory, activeCategory,
    getMyCategories, updateCategory, getActiveCategories, getCategoryIndexList, getCategoryFeed, getParticipantsByCategory,
    getEtiquetasList, searchEtiquetas, getPopularCategoriesList, getTrendingTagsList,
    getCategoryEditHistory, pinCategoryItem, unpinCategoryItem,
    pinCategoryHome, unpinCategoryHome,
    subscribeCategory, unsubscribeCategory, getCategorySubscription } from '../controllers/category.controller.js';
import { protect, isAdmin, optionalAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', protect, isAdmin, getCategories);
router.get('/active', getActiveCategories);
router.get('/index', getCategoryIndexList);
router.get('/feed', optionalAuth, getCategoryFeed);
router.get('/etiquetas', getEtiquetasList);
router.get('/etiquetas/search', searchEtiquetas);
router.post('/create', protect, createCategory);
router.get('/me', protect, getMyCategories);

router.get('/popular', getPopularCategoriesList);
router.get('/trending-tags', getTrendingTagsList);

router.get('/:id/history', getCategoryEditHistory);
router.patch('/:id', protect, updateCategory);
router.get('/:id', getCategoryById);

router.get('/:id/participants', protect, getParticipantsByCategory);

router.delete('/:id/delete', protect, deleteCategory)
router.patch('/:id/activar', protect, activeCategory)

router.post('/:id/pin', protect, pinCategoryItem);
router.delete('/:id/pin/:tipo', protect, unpinCategoryItem);

router.post('/:id/pin-home', protect, isAdmin, pinCategoryHome);
router.delete('/:id/pin-home', protect, isAdmin, unpinCategoryHome);

router.get('/:id/subscription', protect, getCategorySubscription);
router.post('/:id/subscribe', protect, subscribeCategory);
router.delete('/:id/subscribe', protect, unsubscribeCategory);


export default router;