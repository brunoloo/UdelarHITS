import { Router } from 'express';
import { crearReporte } from '../controllers/report.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/create', protect, crearReporte);   // Reportar un contenido (tema o comentario)

export default router;