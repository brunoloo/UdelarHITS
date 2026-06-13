import { Router } from 'express';
import {
  crearApelacion,
  listarApelacionesPendientes,
  resolverApelacion,
  getMyModeratedContent
} from '../controllers/appeal.controller.js';
import { protect, isAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/create', protect, crearApelacion);                       // Usuario apela su contenido
router.get('/pending', protect, isAdmin, listarApelacionesPendientes); // Admin lista pendientes (?tipo=)
router.patch('/:id/resolve', protect, isAdmin, resolverApelacion);     // Admin acepta/rechaza
router.get('/my-moderated-content', protect, getMyModeratedContent);   // lista tu contenido moderado

export default router;