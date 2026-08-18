import { Router } from 'express';
import { searchSite } from '../controllers/search.controller.js';
import { optionalAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// Búsqueda unificada del sitio (categorías, temas, comentarios, usuarios).
// optionalAuth: sin login funciona igual; con login excluye bloqueados de la
// sección de usuarios. El rate limit se monta en app.js.
router.get('/', optionalAuth, searchSite);

export default router;
