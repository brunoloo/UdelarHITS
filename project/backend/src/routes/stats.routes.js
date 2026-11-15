import { Router } from 'express';
import { getCommunityStats } from '../controllers/stats.controller.js';

const router = Router();

router.get('/community', getCommunityStats);

export default router;
