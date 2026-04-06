import { Router } from 'express';
import UserRoutes from './UserRoutes.js';

const router = Router();

// API routes
router.use('/auth', UserRoutes); 

router.get('/', (_req, res) => {
  res.json({ message: 'API OK' });
});


export default router;