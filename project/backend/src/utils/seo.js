import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// ─────────────────────────────────────────────────────────────────────────────
// Utilidades de SEO / previsualizaciones sociales.
//
// El servidor sirve una SPA de React: el catch-all devuelve siempre el mismo
// index.html con metadata idéntica para todas las rutas. Googlebot ve N URLs con
// el mismo <title>/<description> y las trata como duplicados; WhatsApp/Telegram,
// que no ejecutan JS, generan previews vacías. Este módulo inyecta metadata real
// (desde Postgres) en el HTML servido para las rutas de detalle, SIN migrar a
// SSR: se toma el index.html existente y se reescriben sus etiquetas <meta>.
//
// Todo el contenido dinámico viene de usuarios: SIEMPRE se escapa antes de
// meterlo en el HTML (vía de XSS si no se hiciera).
// ─────────────────────────────────────────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base pública del sitio para URLs canónicas y og:url. Configurable por env; el
// fallback es el dominio de producción. Sin barra final (se agrega en cada path).
export const SITE_URL = (process.env.SITE_URL || 'https://udelarhits.com').replace(/\/+$/, '');
export const SITE_NAME = 'UdelarHITS';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.png`;

// Descripción por defecto (idéntica a la del index.html base): se usa como
// fallback cuando no hay contenido específico.
export const DEFAULT_DESCRIPTION =
  'Foro universitario de la Universidad de la República (Uruguay). Discusiones, preguntas y comunidad estudiantil para compartir conocimiento.';

// ── Escape de HTML ───────────────────────────────────────────────────────────
// Cubre contexto de texto (<title>) y de atributo entre comillas dobles
// (content="..."). Se escapan también comillas simples por robustez.
export function escapeHtml(value) {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Truncado de descripciones ─────────────────────────────────────────────────
// Las descriptions de buscadores/redes se cortan alrededor de ~160 caracteres.
// Se colapsan saltos de línea y espacios, se corta en un límite de palabra
// cuando es posible y se agrega elipsis. Recibe texto CRUDO (sin escapar).
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

// ── Slugify ───────────────────────────────────────────────────────────────────
// Título → slug decorativo para la URL: minúsculas, sin tildes (NFD + descarte
// de diacríticos), no-alfanuméricos a guiones, colapsados y sin guiones al
// borde. Puede quedar vacío (título de solo símbolos): el caller lo contempla.
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

// ── parseLeadingId ────────────────────────────────────────────────────────────
// De un segmento de URL tipo "5" o "5-parciales-de-logica" extrae el id numérico
// líder ("5"). El id es lo que resuelve el lookup; el slug es decorativo. Si no
// hay dígitos al inicio, devuelve null (→ 404 de la SPA).
export function parseLeadingId(param) {
  const m = /^(\d+)/.exec(String(param ?? ''));
  return m ? m[1] : null;
}

// ── Path canónico ─────────────────────────────────────────────────────────────
// Construye "/category/5-slug" (o "/topic/5-slug"). Si el slug queda vacío, se
// usa solo el id ("/category/5").
export function buildCanonicalPath(prefix, id, titulo) {
  const slug = slugify(titulo);
  return slug ? `/${prefix}/${id}-${slug}` : `/${prefix}/${id}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Carga del HTML base (memoizado en memoria — NO se lee de disco por request).
//
// Orden de candidatos:
//   1. frontend/dist/index.html  → build de producción (Vite)
//   2. frontend/index.html       → fuente Vite (dev/test, cuando no hay build)
// Ambos comparten las mismas etiquetas <meta> por defecto, así que la inyección
// funciona idéntica sobre cualquiera de los dos.
// ─────────────────────────────────────────────────────────────────────────────
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

// ── Upsert de etiquetas en el <head> ──────────────────────────────────────────
// Reemplaza la etiqueta si ya existe (para que el crawler lea el valor real, no
// el default); si no existe, la inserta antes de </head>. Robusto frente al
// procesamiento de Vite (no depende de comentarios-marcador).

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

// ─────────────────────────────────────────────────────────────────────────────
// injectSeoMeta(baseHtml, meta)
//
// meta: objeto con valores YA CRUDOS (sin escapar); esta función escapa todo.
//   { title, description, canonical, ogTitle, ogDescription, ogUrl, ogType,
//     ogImage, ogImageWidth, ogImageHeight, robots }
// Campos ausentes caen a defaults sensatos. `robots` controla index/noindex.
// `ogImageWidth`/`ogImageHeight` permiten declarar las dimensiones reales de la
// imagen (por defecto 1200×630); necesario cuando og:image es un avatar cuadrado.
// ─────────────────────────────────────────────────────────────────────────────
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
