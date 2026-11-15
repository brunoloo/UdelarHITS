import { SITE_URL, DEFAULT_OG_IMAGE } from './seo.js';

// Arma URLs que superponen el título sobre una imagen plantilla por tipo. No hace
// llamadas: es composición de URL. Cada título distinto genera un recurso derivado;
// si el volumen crece, conviene limitarlo acá.

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

// Sin prefijo de carpeta: las plantillas se suben desde el panel, donde la carpeta
// no forma parte del public_id.
const TEMPLATE_IDS = {
  category: 'og-base-category',
  topic:    'og-base-topic',
  comment:  'og-base-comment',
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

// Las fuentes del servidor no tienen emojis: se quitan para que no aparezcan rectángulos vacíos.
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

// La coma y la barra son separadores de la transformación y se decodifican antes
// del parse: necesitan doble codificación.
export function encodeCloudinaryText(text) {
  return encodeURIComponent(text)
    .replace(/%2C/gi, '%252C')
    .replace(/%2F/gi, '%252F');
}

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
    + `l_text:Arial_20_bold:${typeLabel},co_rgb:ffffffcc,g_north_west,x_80,y_50/`
    + `l_text:Arial_48_bold:${encodedTitle},co_rgb:ffffff,w_960,c_fit,g_center,y_30`
    + `/${templateId}`;
}

// El recorte a 400×400 hace coincidir la imagen con las dimensiones declaradas en og:image.
export const AVATAR_OG_SIZE = 400;

export function avatarForOg(url) {
  if (!url || !url.includes('/upload/')) return url;
  const transform = `c_fill,w_${AVATAR_OG_SIZE},h_${AVATAR_OG_SIZE}`;
  if (/\/upload\/(?:.+?\/)?v\d+\//.test(url)) {
    return url.replace(/\/upload\/(?:.+?\/)?(v\d+\/)/, `/upload/${transform}/$1`);
  }
  return url.replace(/\/upload\/(?:[^/]*_[^/]*\/)?/, `/upload/${transform}/`);
}
