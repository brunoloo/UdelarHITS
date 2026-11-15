import { Router } from 'express';
import { searchSite } from '../controllers/search.controller.js';
import { optionalAuth } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', optionalAuth, searchSite);

export default router;
