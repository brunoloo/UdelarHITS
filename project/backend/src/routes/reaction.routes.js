import { Router } from 'express';
import { toggleReaction, getReactions } from '../controllers/reaction.controller.js';
import { protect, optionalAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// Toggle reaction (like/dislike) — requires auth
router.post('/:contenidoId', protect, toggleReaction);

// Get reaction counts + user's reaction — public, optional auth for mi_reaccion
router.get('/:contenidoId', optionalAuth, getReactions);

export default router;