import { Router } from 'express';
import { protect, isAdmin } from '../middlewares/auth.middleware.js';
import {
  getPendingImages,
  approvePendingImage,
  rejectPendingImage,
  getPendingCount,
  getComments,
} from '../controllers/admin.controller.js';

const router = Router();

router.get('/pending-count', protect, isAdmin, getPendingCount);
router.get('/comments', protect, isAdmin, getComments);

router.get('/pending-images', protect, isAdmin, getPendingImages);
router.patch('/pending-images/:id/approve', protect, isAdmin, approvePendingImage);
router.patch('/pending-images/:id/reject', protect, isAdmin, rejectPendingImage);

export default router;
