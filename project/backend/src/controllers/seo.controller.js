import { loadBaseHtml, injectSeoMeta, SITE_URL } from '../utils/seo.js';
import {
  resolveCategorySeo, resolveTopicSeo, resolveCommentSeo, resolveProfileSeo,
  buildSitemapXml, buildRobotsTxt, buildAiCatalog,
} from '../services/seo.service.js';

function queryString(req) {
  const i = req.originalUrl.indexOf('?');
  return i >= 0 ? req.originalUrl.slice(i) : '';
}

function sendDocument(req, res, next, resolved) {
  // Redirige al canónico si el slug cambió o falta.
  if (resolved.canonicalPath && req.path !== resolved.canonicalPath) {
    return res.redirect(301, resolved.canonicalPath + queryString(req));
  }

  const baseHtml = loadBaseHtml();
  if (!baseHtml) {
    // Sin HTML base, resuelve el catch-all.
    return next();
  }

  const html = resolved.meta ? injectSeoMeta(baseHtml, resolved.meta) : baseHtml;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  return res.status(200).send(html);
}

export async function categoryDocument(req, res, next) {
  const resolved = await resolveCategorySeo(req.params.id);
  return sendDocument(req, res, next, resolved);
}

export async function topicDocument(req, res, next) {
  const resolved = await resolveTopicSeo(req.params.id);
  return sendDocument(req, res, next, resolved);
}

export async function commentDocument(req, res, next) {
  const resolved = await resolveCommentSeo(req.params.id);
  return sendDocument(req, res, next, resolved);
}

export async function profileDocument(req, res, next) {
  const resolved = await resolveProfileSeo(req.params.nickname);
  return sendDocument(req, res, next, resolved);
}

// Rutas privadas de la SPA: se sirven con robots=noindex.
export function noindexDocument(req, res, next) {
  return sendDocument(req, res, next, {
    meta: { robots: 'noindex, follow' },
    canonicalPath: null,
  });
}

export async function sitemapDocument(_req, res) {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  try {
    const xml = await buildSitemapXml();
    return res.status(200).send(xml);
  } catch {
    // Si falla la base se responde un sitemap mínimo válido en vez de un error.
    const fallback =
      `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
      `  <url>\n    <loc>${SITE_URL}/</loc>\n  </url>\n` +
      `</urlset>\n`;
    return res.status(200).send(fallback);
  }
}

export function robotsDocument(_req, res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).send(buildRobotsTxt());
}

export function aiCatalogDocument(_req, res) {
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).json(buildAiCatalog());
}
