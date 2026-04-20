import { Router } from 'express';
import pool from '../config/db.js';

// Import sub-routes
import UserRoutes from './user.routes.js';
import AuthRoutes from './auth.routes.js'
import CategoryRoutes from './category.routes.js'
import TopicRoutes from './topic.routes.js'
import ReplyRoutes from './reply.routes.js'

const router = Router();

// API routes
router.use('/auth', AuthRoutes); 
router.use('/users', UserRoutes);
router.use('/categories', CategoryRoutes);
router.use('/topics', TopicRoutes);
router.use('/replies', ReplyRoutes);

router.get('/', (_req, res) => {
  res.json({ 
    ok: true,
    message: 'API OK' });
});

export default router;