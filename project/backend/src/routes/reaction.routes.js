import { Router } from 'express';
import { toggleReaction, getReactions } from '../controllers/reaction.controller.js';
import { protect, optionalAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/:contenidoId', protect, toggleReaction);

router.get('/:contenidoId', optionalAuth, getReactions);

export default router;