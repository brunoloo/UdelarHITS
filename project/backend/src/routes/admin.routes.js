import { Router } from 'express';
import { protect, isAdmin } from '../middlewares/auth.middleware.js';
import {
  getPendingImages,
  approvePendingImage,
  rejectPendingImage,
} from '../controllers/admin.controller.js';

const router = Router();

// Cola de revisión de imágenes moderadas (adjuntos + avatares/banners).
router.get('/pending-images', protect, isAdmin, getPendingImages);              // listar pendientes
router.patch('/pending-images/:id/approve', protect, isAdmin, approvePendingImage); // aprobar (body: { origen })
router.patch('/pending-images/:id/reject', protect, isAdmin, rejectPendingImage);   // rechazar (body: { origen })

export default router;
