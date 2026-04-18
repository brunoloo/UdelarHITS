import { Router } from 'express';
import pool from '../config/db.js';

// Import sub-routes
import UserRoutes from './user.routes.js';
import AuthRoutes from './auth.routes.js'
import CategoryRoutes from './category.routes.js'
import TopicRoutes from './topic.routes.js'

const router = Router();

// API routes
router.use('/auth', AuthRoutes); 
router.use('/users', UserRoutes);
router.use('/categories', CategoryRoutes);
router.use('/topics', TopicRoutes);

router.get('/', (_req, res) => {
  res.json({ 
    ok: true,
    message: 'API OK' });
});

// Esto es solo un ejemplo para verificar la conexión a la base de datos
router.get('/db', async (_req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS now');
    res.json({ ok: true, dbTime: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;