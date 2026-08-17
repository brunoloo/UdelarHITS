import { loadBaseHtml, injectSeoMeta, SITE_URL } from '../utils/seo.js';
import {
  resolveCategorySeo, resolveTopicSeo, resolveProfileSeo,
  buildSitemapXml, buildRobotsTxt,
} from '../services/seo.service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Controlador de SEO. Sirve el index.html de la SPA con metadata inyectada para
// las rutas de detalle, más /sitemap.xml y /robots.txt. Se monta ANTES del
// catch-all de la SPA (ver app.js): estas rutas interceptan el documento HTML;
// la navegación en cliente y el HMR de Vite no se ven afectados (en dev el
// navegador pega contra Vite:5173, no contra Express).
// ─────────────────────────────────────────────────────────────────────────────

// Devuelve el path+query original para preservar querystrings al redirigir.
function queryString(req) {
  const i = req.originalUrl.indexOf('?');
  return i >= 0 ? req.originalUrl.slice(i) : '';
}

// Sirve el HTML base con la metadata resuelta inyectada. Si corresponde un
// canónico distinto (slug editado o ausente), responde 301 hacia él.
function sendDocument(req, res, next, resolved) {
  // Redirect 301 al canónico si el path no coincide (p. ej. slug viejo o sin slug).
  if (resolved.canonicalPath && req.path !== resolved.canonicalPath) {
    return res.redirect(301, resolved.canonicalPath + queryString(req));
  }

  const baseHtml = loadBaseHtml();
  if (!baseHtml) {
    // Sin HTML base disponible (no debería pasar en prod): que el catch-all
    // intente resolverlo. Nunca 500 por esto.
    return next();
  }

  const html = resolved.meta ? injectSeoMeta(baseHtml, resolved.meta) : baseHtml;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // El HTML referencia bundles hasheados (cacheados immutable); él mismo debe
  // quedar siempre fresco para reflejar ediciones de título/descripción.
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

export async function profileDocument(req, res, next) {
  const resolved = await resolveProfileSeo(req.params.nickname);
  return sendDocument(req, res, next, resolved);
}

// Rutas de la SPA que no deben indexarse (settings, admin, chat, auth…). Sirven
// el HTML base con robots=noindex; la SPA pinta su contenido normal en cliente.
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
    // Falla de BD: devolver un sitemap mínimo válido (solo la home) en vez de
    // un error, para no ensuciar Search Console con un fetch fallido.
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
