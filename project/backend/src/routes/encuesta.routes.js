import { Router } from 'express';
import { votePoll } from '../controllers/encuesta.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = Router();

// Votar una opción de la encuesta — requiere auth.
router.post('/:id/vote', protect, votePoll);

export default router;
