import { Router } from 'express';
import { saveItem, unsaveItem, getSavedIds, getSavedList } from '../controllers/saved.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/ids', protect, getSavedIds);
router.get('/', protect, getSavedList);
router.post('/', protect, saveItem);
router.delete('/:tipo/:id', protect, unsaveItem);

export default router;
