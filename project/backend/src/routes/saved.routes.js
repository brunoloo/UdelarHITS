import { Router } from 'express';
import { saveItem, unsaveItem, getSavedIds, getSavedList } from '../controllers/saved.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/ids', protect, getSavedIds);        // Ids de lo guardado (para los íconos)
router.get('/', protect, getSavedList);           // Listado completo del panel
router.post('/', protect, saveItem);              // Guardar { tipo, id }
router.delete('/:tipo/:id', protect, unsaveItem); // Quitar de guardados

export default router;
