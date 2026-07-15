import { Router } from 'express';
import { createCategory, getCategories, getCategoryById, deleteCategory, activeCategory,
    getMyCategories, updateCategory, getActiveCategories, getCategoryFeed, getParticipantsByCategory,
    getEtiquetasList, searchEtiquetas, getPopularCategoriesList, getTrendingTagsList,
    getCategoryEditHistory, pinCategoryItem, unpinCategoryItem,
    pinCategoryHome, unpinCategoryHome,
    subscribeCategory, unsubscribeCategory, getCategorySubscription } from '../controllers/category.controller.js';
import { protect, isAdmin, optionalAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', protect, isAdmin, getCategories);        // Listar categorías  
router.get('/active', getActiveCategories);              // Listar categorías activas
router.get('/feed', optionalAuth, getCategoryFeed);      // Home: feed personalizado paginado
router.get('/etiquetas', getEtiquetasList);              // Obtener las etiquetas (agrupadas)
router.get('/etiquetas/search', searchEtiquetas);       // Buscar etiquetas por nombre
router.post('/create', protect, createCategory);         // Crear categoría
router.get('/me', protect, getMyCategories);             // Ver mis categorías

router.get('/popular', getPopularCategoriesList);        // Lista de categorías populares
router.get('/trending-tags', getTrendingTagsList);       // Etiquetas en tendencia (actividad 7d, público)

router.get('/:id/history', getCategoryEditHistory);      // Obtener edición de categoría
router.patch('/:id', protect, updateCategory);           // Actualizar categoría
router.get('/:id', getCategoryById);                     // Ver categoría por id

router.get('/:id/participants', protect, getParticipantsByCategory); // Obtener los participantes de mi categoría

router.delete('/:id/delete', protect, deleteCategory)     // Desactiva la categoría
router.patch('/:id/activar', protect, activeCategory)    // Activa la categoría

router.post('/:id/pin', protect, pinCategoryItem);          // Fijar tema/comentario (moderador)
router.delete('/:id/pin/:tipo', protect, unpinCategoryItem); // Desanclar tema/comentario

router.post('/:id/pin-home', protect, isAdmin, pinCategoryHome);     // Fijar categoría en el Home (admin)
router.delete('/:id/pin-home', protect, isAdmin, unpinCategoryHome); // Desanclar categoría del Home (admin)

router.get('/:id/subscription', protect, getCategorySubscription); // ¿Estoy suscrito?
router.post('/:id/subscribe', protect, subscribeCategory);          // Suscribirse (campanita)
router.delete('/:id/subscribe', protect, unsubscribeCategory);     // Desuscribirse


export default router;