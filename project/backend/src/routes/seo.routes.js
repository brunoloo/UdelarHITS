import { Router } from 'express';
import {
  categoryDocument, topicDocument, commentDocument, profileDocument,
  noindexDocument, sitemapDocument, robotsDocument,
} from '../controllers/seo.controller.js';

// ─────────────────────────────────────────────────────────────────────────────
// Rutas de SEO (documentos HTML + sitemap + robots). Se montan en app.js DESPUÉS
// de /api y ANTES del catch-all de la SPA, para interceptar las rutas de detalle
// y devolver el index.html con metadata inyectada. Todo lo que NO cae acá sigue
// al catch-all con la metadata por defecto (indexable): home, /about, etc.
// ─────────────────────────────────────────────────────────────────────────────
const router = Router();

// Archivos de crawleo servidos desde la raíz.
router.get('/robots.txt', robotsDocument);
router.get('/sitemap.xml', sitemapDocument);

// Rutas de detalle con metadata dinámica + slug (301 al canónico si no coincide).
router.get('/category/:id', categoryDocument);
router.get('/topic/:id', topicDocument);
router.get('/comment/:id', commentDocument);
router.get('/user/:nickname', profileDocument);

// Rutas de la SPA que no deben indexarse (privadas o sin valor de búsqueda).
router.get('/settings', noindexDocument);
router.get('/admin', noindexDocument);
router.get('/chat', noindexDocument);
router.get('/chat/:nickname', noindexDocument);
router.get('/login', noindexDocument);
router.get('/register', noindexDocument);
router.get('/setup-profile', noindexDocument);
router.get('/redirect', noindexDocument);

export default router;
