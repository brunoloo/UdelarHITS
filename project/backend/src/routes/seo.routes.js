import { Router } from 'express';
import {
  categoryDocument, topicDocument, commentDocument, profileDocument,
  noindexDocument, sitemapDocument, robotsDocument, aiCatalogDocument,
} from '../controllers/seo.controller.js';

const router = Router();

router.get('/robots.txt', robotsDocument);
router.get('/sitemap.xml', sitemapDocument);
router.get('/.well-known/ai-catalog.json', aiCatalogDocument);

router.get('/category/:id', categoryDocument);
router.get('/topic/:id', topicDocument);
router.get('/comment/:id', commentDocument);
router.get('/user/:nickname', profileDocument);

router.get('/settings', noindexDocument);
router.get('/admin', noindexDocument);
router.get('/chat', noindexDocument);
router.get('/chat/:nickname', noindexDocument);
router.get('/login', noindexDocument);
router.get('/register', noindexDocument);
router.get('/setup-profile', noindexDocument);
router.get('/redirect', noindexDocument);

export default router;
