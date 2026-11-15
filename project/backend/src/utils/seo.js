import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Inyecta metadata por URL en el index.html de la SPA, para buscadores y previews que
// no ejecutan JS. Todo el contenido viene de usuarios: se escapa siempre antes de insertarlo.

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sin barra final.
export const SITE_URL = (process.env.SITE_URL || 'https://udelarhits.com').replace(/\/+$/, '');
export const SITE_NAME = 'UdelarHITS';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

// Igual a la del index.html base.
export const DEFAULT_DESCRIPTION =
  'Foro universitario de la Universidad de la República (Uruguay). Discusiones, preguntas y comunidad estudiantil para compartir conocimiento.';

// Cubre texto y atributos entre comillas dobles.
export function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Colapsa espacios, corta en un límite de palabra y agrega elipsis. Recibe texto sin escapar.
export function truncateDescription(text, max = 160) {
  if (!text) return '';
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  // Reservar espacio para la elipsis (1 char: '…').
  const slice = clean.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trim()}…`;
}

// Puede quedar vacío si el título solo tiene símbolos.
export function slugify(text) {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // diacríticos (tildes, diéresis)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

// De "5-parciales-de-logica" extrae "5"; null si no empieza con dígitos.
export function parseLeadingId(param) {
  const m = /^(\d+)/.exec(String(param ?? ''));
  return m ? m[1] : null;
}

// Si el slug queda vacío se usa solo el id.
export function buildCanonicalPath(prefix, id, titulo) {
  const slug = slugify(titulo);
  return slug ? `/${prefix}/${id}-${slug}` : `/${prefix}/${id}`;
}

// El HTML base se lee una sola vez. Primero el build; si no existe, el fuente (dev y test).
const BASE_HTML_CANDIDATES = [
  path.join(__dirname, '..', '..', '..', 'frontend', 'dist', 'index.html'),
  path.join(process.cwd(), 'frontend', 'dist', 'index.html'),
  path.join(process.cwd(), '..', 'frontend', 'dist', 'index.html'),
  path.join(__dirname, '..', '..', '..', 'frontend', 'index.html'),
  path.join(process.cwd(), 'frontend', 'index.html'),
  path.join(process.cwd(), '..', 'frontend', 'index.html'),
];

let cachedBaseHtml = null;

export function loadBaseHtml() {
  if (cachedBaseHtml != null) return cachedBaseHtml;
  for (const candidate of BASE_HTML_CANDIDATES) {
    try {
      if (fs.existsSync(candidate)) {
        cachedBaseHtml = fs.readFileSync(candidate, 'utf8');
        return cachedBaseHtml;
      }
    } catch {
      // Ignorar candidato ilegible y probar el siguiente.
    }
  }
  cachedBaseHtml = null;
  return cachedBaseHtml;
}

// Solo para tests: invalida la cache del HTML base.
export function __resetBaseHtmlCache() {
  cachedBaseHtml = null;
}

// Reemplaza la etiqueta si existe; si no, la inserta antes de </head>.

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function upsertTitle(html, title) {
  const tag = `<title>${title}</title>`;
  if (/<title>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/<title>[\s\S]*?<\/title>/i, tag);
  }
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

function upsertMeta(html, attr, key, content) {
  const re = new RegExp(`<meta\\s+${attr}=["']${escapeRegExp(key)}["'][^>]*>`, 'i');
  const tag = `<meta ${attr}="${key}" content="${content}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

function upsertCanonical(html, href) {
  const re = /<link\s+rel=["']canonical["'][^>]*>/i;
  const tag = `<link rel="canonical" href="${href}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

// `meta` llega sin escapar; esta función escapa todo. Los campos ausentes usan valores por defecto.
export function injectSeoMeta(baseHtml, meta = {}) {
  if (!baseHtml) return baseHtml;

  const title = escapeHtml(meta.title || SITE_NAME);
  const description = escapeHtml(meta.description || DEFAULT_DESCRIPTION);
  const canonical = escapeHtml(meta.canonical || `${SITE_URL}/`);
  const ogTitle = escapeHtml(meta.ogTitle || meta.title || SITE_NAME);
  const ogDescription = escapeHtml(meta.ogDescription || meta.description || DEFAULT_DESCRIPTION);
  const ogUrl = escapeHtml(meta.ogUrl || meta.canonical || `${SITE_URL}/`);
  const ogType = escapeHtml(meta.ogType || 'website');
  const ogImage = escapeHtml(meta.ogImage || DEFAULT_OG_IMAGE);
  const ogImageWidth = String(meta.ogImageWidth || 1200);
  const ogImageHeight = String(meta.ogImageHeight || 630);
  const robots = escapeHtml(meta.robots || 'index, follow');

  let html = baseHtml;
  html = upsertTitle(html, title);
  html = upsertMeta(html, 'name', 'description', description);
  html = upsertMeta(html, 'name', 'robots', robots);
  html = upsertCanonical(html, canonical);
  html = upsertMeta(html, 'property', 'og:title', ogTitle);
  html = upsertMeta(html, 'property', 'og:description', ogDescription);
  html = upsertMeta(html, 'property', 'og:type', ogType);
  html = upsertMeta(html, 'property', 'og:url', ogUrl);
  html = upsertMeta(html, 'property', 'og:image', ogImage);
  html = upsertMeta(html, 'property', 'og:image:width', ogImageWidth);
  html = upsertMeta(html, 'property', 'og:image:height', ogImageHeight);
  html = upsertMeta(html, 'property', 'og:site_name', escapeHtml(SITE_NAME));
  html = upsertMeta(html, 'name', 'twitter:card', 'summary_large_image');
  return html;
}
