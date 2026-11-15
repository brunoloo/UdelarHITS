import { Router } from 'express';
import { votePoll } from '../controllers/encuesta.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/:id/vote', protect, votePoll);

export default router;
