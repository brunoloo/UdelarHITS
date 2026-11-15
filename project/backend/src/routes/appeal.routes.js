import { Router } from 'express';
import {
  crearApelacion,
  listarApelacionesPendientes,
  resolverApelacion,
  getMyModeratedContent
} from '../controllers/appeal.controller.js';
import { protect, isAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/create', protect, crearApelacion);
router.get('/pending', protect, isAdmin, listarApelacionesPendientes);
router.patch('/:id/resolve', protect, isAdmin, resolverApelacion);
router.get('/my-moderated-content', protect, getMyModeratedContent);

export default router;