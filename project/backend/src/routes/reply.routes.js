import { Router } from 'express';
import { } from '../controllers/reply.controller.js';
import { protect, isAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

//router.post('/create', protect, createReply);    // Publicar comentario

export default router;