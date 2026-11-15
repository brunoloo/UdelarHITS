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

// Nunca lanza por un problema de datos: si la consulta falla devuelve { meta: null }
// y se sirve el HTML base. Contenido inexistente o inactivo recibe noindex.

function noindexMeta() {
  return {
    title: SITE_NAME,
    description: DEFAULT_DESCRIPTION,
    robots: 'noindex, follow',
  };
}

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

// Los perfiles nunca se indexan: verlos requiere cuenta. La preview social muestra
// lo mismo que la página de perfil; cuentas inactivas o inexistentes reciben metadata genérica.
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

// Manifiesto de /.well-known/ai-catalog.json. El sitio no publica agentes, así que
// `entries` va vacío. Spec: https://agenticresourcediscovery.org/spec/
export function buildAiCatalog() {
  return {
    specVersion: '1.0',
    host: {
      displayName: SITE_NAME,
      documentationUrl: `${SITE_URL}/llms.txt`,
      logoUrl: `${SITE_URL}/android-chrome-512x512.png`,
    },
    entries: [],
  };
}

export { slugify };
