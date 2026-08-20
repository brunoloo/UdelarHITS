import {
  getCategorySeoData, getTopicSeoData, getProfileSeoData,
  getCommentSeoData, getSitemapCategories, getSitemapTopics,
} from '../repositories/seo.repository.js';
import {
  SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION, DEFAULT_OG_IMAGE,
  slugify, parseLeadingId, buildCanonicalPath, truncateDescription, escapeHtml,
} from '../utils/seo.js';
import {
  buildOgImageUrl, avatarForOg, OG_WIDTH, OG_HEIGHT, AVATAR_OG_SIZE,
} from '../utils/ogImage.js';

// ─────────────────────────────────────────────────────────────────────────────
// Servicio de SEO. Resuelve la metadata de cada ruta de detalle y construye el
// sitemap y el robots. Contrato de robustez:
//   · Nunca lanza por un problema de datos: si la query a la BD falla, devuelve
//     { meta: null } para que el controller sirva el HTML por defecto (jamás 500).
//   · Contenido inexistente o inactivo → meta con `noindex` (la SPA maneja su 404).
//   · Solo contenido activo/público recibe metadata indexable.
//
// El resultado de resolve* es:
//   { meta, canonicalPath }
//     meta         → objeto para injectSeoMeta, o null (usar HTML base tal cual)
//     canonicalPath→ path canónico "/category/5-slug" o null (sin redirect posible)
// ─────────────────────────────────────────────────────────────────────────────

function noindexMeta() {
  return {
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    robots: 'noindex, follow',
  };
}

// ── Categoría ────────────────────────────────────────────────────────────────
export async function resolveCategorySeo(param) {
  const id = parseLeadingId(param);
  if (!id) return { meta: noindexMeta(), canonicalPath: null };

  let row;
  try {
    row = await getCategorySeoData(id);
  } catch {
    return { meta: null, canonicalPath: null };
  }

  if (!row || row.estado !== 'activa') {
    return { meta: noindexMeta(), canonicalPath: null };
  }

  const canonicalPath = buildCanonicalPath('category', id, row.titulo);
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const description = truncateDescription(row.descripcion) || DEFAULT_DESCRIPTION;

  return {
    meta: {
      title: `${row.titulo} · ${SITE_NAME}`,
      description,
      canonical: canonicalUrl,
      ogTitle: row.titulo,
      ogDescription: description,
      ogUrl: canonicalUrl,
      ogType: 'website',
      ogImage: buildOgImageUrl('category', row.titulo),
      ogImageWidth: OG_WIDTH,
      ogImageHeight: OG_HEIGHT,
      robots: 'index, follow',
    },
    canonicalPath,
  };
}

// ── Tema ─────────────────────────────────────────────────────────────────────
export async function resolveTopicSeo(param) {
  const id = parseLeadingId(param);
  if (!id) return { meta: noindexMeta(), canonicalPath: null };

  let row;
  try {
    row = await getTopicSeoData(id);
  } catch {
    return { meta: null, canonicalPath: null };
  }

  if (!row || row.estado !== 'activo' || row.categoria_estado !== 'activa') {
    return { meta: noindexMeta(), canonicalPath: null };
  }

  const canonicalPath = buildCanonicalPath('topic', id, row.titulo);
  const canonicalUrl = `${SITE_URL}${canonicalPath}`;
  const description =
    truncateDescription(row.cuerpo) || `Tema en ${row.categoria_titulo} · ${SITE_NAME}`;

  return {
    meta: {
      title: `${row.titulo} · ${row.categoria_titulo} · ${SITE_NAME}`,
      description,
      canonical: canonicalUrl,
      ogTitle: row.titulo,
      ogDescription: description,
      ogUrl: canonicalUrl,
      ogType: 'article',
      ogImage: buildOgImageUrl('topic', row.titulo),
      ogImageWidth: OG_WIDTH,
      ogImageHeight: OG_HEIGHT,
      robots: 'index, follow',
    },
    canonicalPath,
  };
}

// ── Comentario ──────────────────────────────────────────────────────────────
export async function resolveCommentSeo(param) {
  const id = parseLeadingId(param);
  if (!id) return { meta: noindexMeta(), canonicalPath: null };

  let row;
  try {
    row = await getCommentSeoData(id);
  } catch {
    return { meta: null, canonicalPath: null };
  }

  if (!row || row.estado !== 'visible') {
    return { meta: noindexMeta(), canonicalPath: null };
  }

  const contextTitle = row.tema_titulo || row.categoria_titulo || SITE_NAME;
  const bodyPreview = truncateDescription(row.cuerpo) || `Comentario en ${contextTitle}`;
  const url = `${SITE_URL}/comment/${id}`;

  return {
    meta: {
      title: `Comentario en ${contextTitle} · ${SITE_NAME}`,
      description: bodyPreview,
      canonical: url,
      ogTitle: bodyPreview,
      ogDescription: `Comentario en ${contextTitle}`,
      ogUrl: url,
      ogType: 'article',
      ogImage: buildOgImageUrl('comment', row.cuerpo),
      ogImageWidth: OG_WIDTH,
      ogImageHeight: OG_HEIGHT,
      robots: 'noindex, follow',
    },
    canonicalPath: null,
  };
}

// ── Perfil ───────────────────────────────────────────────────────────────────
// Dos capas de decisión:
//
//   1) Indexación: los perfiles NUNCA se indexan (`noindex`). Ver un perfil
//      requiere cuenta (GET /api/users/:nickname está detrás de `protect`), así
//      que para Googlebot es contenido tras login: indexarlo daría resultados
//      thin/cloaked.
//
//   2) Privacidad de la preview social (og:*): la preview expone exactamente lo
//      que la página de perfil expone, ni más ni menos. Toda cuenta ACTIVA
//      (pública o privada) muestra nickname, avatar y biografía, porque
//      cualquier usuario autenticado los ve en la página. Ocultar alguno en la
//      preview haría que el link se vea peor sin proteger nada.
//      Cuentas inactivas, baneadas o inexistentes → metadata genérica.
export async function resolveProfileSeo(nickname) {
  let row;
  try {
    row = await getProfileSeoData(nickname);
  } catch {
    return { meta: null, canonicalPath: null };
  }

  if (!row || row.estado !== 'activo') {
    return { meta: genericProfileMeta(), canonicalPath: null };
  }

  const url = `${SITE_URL}/user/${encodeURIComponent(row.nickname)}`;

  const description =
    truncateDescription(row.biografia) || `Perfil de ${row.nickname} en ${SITE_NAME}`;

  const hasAvatar = !!row.url_imagen;

  return {
    meta: {
      title: `${row.nickname} · ${SITE_NAME}`,
      description,
      canonical: url,
      ogTitle: row.nickname,
      ogDescription: description,
      ogUrl: url,
      ogType: 'profile',
      ogImage: hasAvatar ? avatarForOg(row.url_imagen) : undefined,
      ogImageWidth: hasAvatar ? AVATAR_OG_SIZE : undefined,
      ogImageHeight: hasAvatar ? AVATAR_OG_SIZE : undefined,
      robots: 'noindex, follow',
    },
    canonicalPath: null,
  };
}

function genericProfileMeta() {
  return {
    title: `Perfil en ${SITE_NAME}`,
    description: DEFAULT_DESCRIPTION,
    ogTitle: `Perfil en ${SITE_NAME}`,
    ogDescription: DEFAULT_DESCRIPTION,
    ogType: 'profile',
    robots: 'noindex, follow',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sitemap
// ─────────────────────────────────────────────────────────────────────────────
function escapeXml(value) {
  return escapeHtml(value); // mismo set de entidades; válido para XML
}

function urlEntry(loc, lastmod) {
  const parts = [`    <loc>${escapeXml(loc)}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
  return `  <url>\n${parts.join('\n')}\n  </url>`;
}

const STATIC_PATHS = ['/', '/recent', '/popular', '/explore', '/about', '/about/rules', '/about/policies', '/about/moderation'];

export async function buildSitemapXml() {
  const [categories, topics] = await Promise.all([
    getSitemapCategories(),
    getSitemapTopics(),
  ]);

  const entries = [];

  for (const p of STATIC_PATHS) {
    entries.push(urlEntry(`${SITE_URL}${p}`));
  }

  for (const c of categories) {
    const path = buildCanonicalPath('category', c.id, c.titulo);
    entries.push(urlEntry(`${SITE_URL}${path}`, toIsoDate(c.fecha_creacion)));
  }

  for (const t of topics) {
    const path = buildCanonicalPath('topic', t.id, t.titulo);
    entries.push(urlEntry(`${SITE_URL}${path}`, toIsoDate(t.fecha_creacion)));
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${entries.join('\n')}\n` +
    `</urlset>\n`;
}

function toIsoDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────
// robots.txt
// ─────────────────────────────────────────────────────────────────────────────
export function buildRobotsTxt() {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /settings',
    'Disallow: /admin',
    'Disallow: /chat',
    'Disallow: /login',
    'Disallow: /register',
    'Disallow: /setup-profile',
    'Disallow: /redirect',
    'Disallow: /user/',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n');
}

export { slugify };
