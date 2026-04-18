import { Router } from 'express';
import { createTopic } from '../controllers/topic.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = Router();

router.post('/create', protect, createTopic);

export default router;