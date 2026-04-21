import { Router } from 'express';
import { createCategory, getCategories, getCategoryById, deleteCategory, activeCategory, 
    getMyCategories, updateCategory, getActiveCategories } from '../controllers/category.controller.js';
import { protect, isAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', protect, isAdmin, getCategories);        // Listar categorías  
router.get('/active', protect, getActiveCategories);     // Listar categorías  
router.post('/create', protect, createCategory);         // Crear categoría
router.get('/me', protect, getMyCategories);             // Ver mis categorías

router.patch('/:id', protect, updateCategory);           // Actualizar categoría
router.get('/:id', protect , getCategoryById);           // Ver categoría por id

router.patch('/:id/delete', protect, deleteCategory)     // Desactiva la categoría
router.patch('/:id/activar', protect, activeCategory)    // Activa la categoría 


export default router;