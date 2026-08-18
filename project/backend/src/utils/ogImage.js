import { SITE_URL, DEFAULT_OG_IMAGE } from './seo.js';

// ─────────────────────────────────────────────────────────────────────────────
// Generación de imágenes OG dinámicas vía Cloudinary text overlays.
//
// Construye URLs de Cloudinary que superponen el título del contenido sobre una
// imagen-plantilla base, distinta por tipo (categoría / tema / comentario). La
// URL es un "recurso derivado" de Cloudinary: cada combinación título+plantilla
// se cachea en su CDN tras el primer fetch. No se hace ningún API call; es solo
// composición de URL.
//
// ── Derivados y volumen ──────────────────────────────────────────────────────
// Cada título único genera UN recurso derivado en Cloudinary (por plantilla).
// Con el volumen actual del sitio esto no es problema. Si crece de manera
// significativa, limitar acá — p.ej. con un caché LRU de URLs ya generadas, o
// usando named transformations de Cloudinary para reducir la cuenta de derivados.
// ─────────────────────────────────────────────────────────────────────────────

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

// IDs públicos de las plantillas-base en Cloudinary. Cada una tiene fondo de un
// color distinto + branding del sitio — subirlas una vez al account es suficiente.
//   categoría → azul accent (#2563eb)
//   tema      → azul oscuro (#1d4ed8)
//   comentario→ navy (#0f1a2e)
const TEMPLATE_IDS = {
  category: 'udelarhits/og-base-category',
  topic:    'udelarhits/og-base-topic',
  comment:  'udelarhits/og-base-comment',
};

const FALLBACK_IMAGES = {
  category: `${SITE_URL}/og-category.png`,
  topic:    `${SITE_URL}/og-topic.png`,
  comment:  `${SITE_URL}/og-comment.png`,
};

const MAX_TITLE_LENGTH = 80;

const TYPE_LABELS = {
  category: 'CATEGOR%C3%8DA',
  topic:    'TEMA',
  comment:  'COMENTARIO',
};

// ── Limpieza de texto para renderizado server-side ──────────────────────────
// Cloudinary renderiza texto con fuentes del servidor. Los emojis y símbolos
// pictográficos NO están disponibles en fuentes estándar (Arial, Helvetica) y
// producirían rectángulos vacíos. Se eliminan para que el overlay solo contenga
// caracteres renderizables.
const EMOJI_RE = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}\u{2300}-\u{23FF}\u{2B50}\u{2B55}\u{203C}\u{2049}\u{25AA}-\u{25FE}\u{2934}-\u{2935}\u{3030}\u{3297}\u{3299}\u{FE0E}]/gu;

export function stripEmojis(text) {
  if (!text) return '';
  return text.replace(EMOJI_RE, '').replace(/\s+/g, ' ').trim();
}

export function truncateTitle(text, max = MAX_TITLE_LENGTH) {
  if (!text) return '';
  const clean = String(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max - 1);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > max * 0.5 ? slice.slice(0, lastSpace) : slice;
  return `${cut.trim()}…`;
}

// ── Encoding para text overlay de Cloudinary ────────────────────────────────
// El texto va en el path de la URL como parte del parámetro `l_text:style:TEXT`.
// Se necesita URL-encoding estándar (encodeURIComponent) para que caracteres
// como espacios, signos de interrogación y acentos no rompan el path.
export function encodeCloudinaryText(text) {
  return encodeURIComponent(text);
}

// ── Construcción de la URL de OG image ──────────────────────────────────────
export function buildOgImageUrl(type, rawTitle) {
  const fallback = FALLBACK_IMAGES[type] || DEFAULT_OG_IMAGE;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

  if (!cloudName) return fallback;

  const cleaned = stripEmojis(rawTitle);
  const truncated = truncateTitle(cleaned);

  if (!truncated) return fallback;

  const templateId = TEMPLATE_IDS[type];
  if (!templateId) return fallback;

  const encodedTitle = encodeCloudinaryText(truncated);
  const typeLabel = TYPE_LABELS[type] || '';

  return `https://res.cloudinary.com/${cloudName}/image/upload/`
    + `w_${OG_WIDTH},h_${OG_HEIGHT},c_fill/`
    + `l_text:Arial_20_bold:${typeLabel},co_rgb:ffffffcc,g_north_west,x_60,y_50/`
    + `l_text:Arial_52_bold:${encodedTitle},co_rgb:ffffff,w_1000,c_fit,g_west,x_100,y_40`
    + `/${templateId}`;
}

// ── Avatar transformado para OG image ───────────────────────────────────────
// Aplica c_fill 400×400 al avatar de Cloudinary para que las dimensiones
// declaradas en og:image:width/height coincidan con la imagen real.
export const AVATAR_OG_SIZE = 400;

export function avatarForOg(url) {
  if (!url || !url.includes('/upload/')) return url;
  const transform = `c_fill,w_${AVATAR_OG_SIZE},h_${AVATAR_OG_SIZE}`;
  if (/\/upload\/(?:.+?\/)?v\d+\//.test(url)) {
    return url.replace(/\/upload\/(?:.+?\/)?(v\d+\/)/, `/upload/${transform}/$1`);
  }
  return url.replace(/\/upload\/(?:[^/]*_[^/]*\/)?/, `/upload/${transform}/`);
}
