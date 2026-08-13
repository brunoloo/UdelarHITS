import {
  getCategorySeoData, getTopicSeoData, getProfileSeoData,
  getSitemapCategories, getSitemapTopics,
} from '../repositories/seo.repository.js';
import {
  SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION,
  slugify, parseLeadingId, buildCanonicalPath, truncateDescription, escapeHtml,
} from '../utils/seo.js';

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

// Metadata "noindex" para contenido inexistente/inactivo/privado: la SPA pintará
// su propio 404 o su pantalla de login; le decimos a Google que no lo indexe.
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
    // Falla de BD: servir el HTML por defecto (sin tocar), nunca 500.
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

  // El tema debe estar activo Y su categoría contenedora también.
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
      robots: 'index, follow',
    },
    canonicalPath,
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
//   2) Privacidad de la preview social (og:*): la preview la genera el servidor
//      desde la BD, esquivando el `protect` de la API. Por eso SOLO se inyectan
//      nickname, biografía y avatar cuando la cuenta es PÚBLICA y está ACTIVA.
//      Para cuentas con `privado = true`, `estado` inactivo/baneado —o perfiles
//      inexistentes— se sirve metadata GENÉRICA del sitio (sin nickname real,
//      sin biografía, sin avatar). Esto respeta `usuario.privado` y la política
//      de privacidad publicada, y de paso hace indistinguible "privada" de "no
//      existe" (no se pueden enumerar cuentas privadas).
export async function resolveProfileSeo(nickname) {
  let row;
  try {
    row = await getProfileSeoData(nickname);
  } catch {
    return { meta: null, canonicalPath: null };
  }

  const isPublicActive = !!row && row.estado === 'activo' && row.privado === false;

  if (!isPublicActive) {
    return { meta: genericProfileMeta(), canonicalPath: null };
  }

  const url = `${SITE_URL}/user/${encodeURIComponent(row.nickname)}`;
  const description =
    truncateDescription(row.biografia) || `Perfil de ${row.nickname} en ${SITE_NAME}`;

  return {
    meta: {
      title: `${row.nickname} · ${SITE_NAME}`,
      description,
      canonical: url,
      ogTitle: row.nickname,
      ogDescription: description,
      ogUrl: url,
      ogType: 'profile',
      // Avatar como og:image SOLO en cuentas públicas activas; si no tiene
      // avatar, injectSeoMeta cae a la imagen por defecto del sitio.
      ogImage: row.url_imagen || undefined,
      robots: 'noindex, follow',
    },
    canonicalPath: null, // el nickname es el canónico; no hay slug que redirigir
  };
}

// Metadata genérica del sitio para perfiles que no pueden exponer datos (cuenta
// privada, inactiva, baneada o inexistente). Sin nickname real, sin biografía y
// sin avatar: og:image queda en la imagen por defecto del sitio.
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

// Rutas estáticas públicas de la SPA (contenido de "La Central" y navegación).
const STATIC_PATHS = ['/', '/recent', '/popular', '/explore', '/about', '/about/rules', '/about/policies', '/about/moderation'];

export async function buildSitemapXml() {
  // Con el volumen actual se genera por request. Si crece, cachear acá el string
  // resultante con un TTL corto (p. ej. 10 min) — TODO: agregar cache cuando el
  // número de categorías/temas lo justifique.
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
    // API y rutas privadas / detrás de sesión: no aportan a la búsqueda.
    'Disallow: /api/',
    'Disallow: /settings',
    'Disallow: /admin',
    'Disallow: /chat',
    'Disallow: /login',
    'Disallow: /register',
    'Disallow: /setup-profile',
    'Disallow: /redirect',
    // Perfiles: ver un perfil requiere cuenta → fuera del índice.
    'Disallow: /user/',
    '',
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    '',
  ].join('\n');
}

// Exponer slugify por si el controller lo necesita para logs/diagnóstico.
export { slugify };
