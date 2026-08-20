import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createCategory, createTopic } from '../helpers.js';
import { SITE_URL } from '../../src/utils/seo.js';

// ─── sitemap.xml dinámico + robots.txt ───

// Las URLs públicas se verifican contra el dominio configurado en el entorno
// (SITE_URL), no contra un dominio hardcodeado: así el test no se rompe si
// cambia el dominio o se agrega staging. Pero además se exige que la URL sea
// ABSOLUTA y bien formada — si la construcción devolviera una ruta relativa, el
// test debe fallar igual.
const isAbsoluteHttpUrl = (u) => {
  if (typeof u !== 'string' || !/^https?:\/\/[^/]+/.test(u)) return false;
  try { new URL(u); return true; } catch { return false; }
};
const sitemapLocs = (xml) => [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);

describe('GET /sitemap.xml', () => {
  test('XML válido con categorías y temas activos (URLs con slug + lastmod)', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie, {
      titulo: 'Programacion Uno',
      descripcion: 'P1',
    });
    const topic = await createTopic(a.cookie, {
      categoria_id: cat.id,
      titulo: 'Recursion y punteros',
    });
    const topicId = topic.id ?? topic.contenido_id;

    const res = await request(app).get('/sitemap.xml');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/xml/);
    expect(res.text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(res.text).toContain('<urlset');

    // Toda <loc> del sitemap debe ser una URL absoluta y bien formada (nunca
    // una ruta relativa), sea cual sea el dominio configurado.
    const urls = sitemapLocs(res.text);
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) expect(isAbsoluteHttpUrl(u)).toBe(true);

    // URLs con slug, apuntando al dominio configurado en el entorno (SITE_URL).
    expect(res.text).toContain(`<loc>${SITE_URL}/category/${cat.id}-programacion-uno</loc>`);
    expect(res.text).toContain(`<loc>${SITE_URL}/topic/${topicId}-recursion-y-punteros</loc>`);
    // lastmod presente (ISO).
    expect(res.text).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}T/);
    // Rutas estáticas públicas.
    expect(res.text).toContain(`<loc>${SITE_URL}/</loc>`);
    expect(res.text).toContain(`<loc>${SITE_URL}/about</loc>`);
  });

  test('excluye categorías y temas inactivos', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie, {
      titulo: 'Categoria Oculta',
      descripcion: 'x',
    });
    await pool.query(`UPDATE categoria SET estado = 'inactiva' WHERE id = $1`, [cat.id]);

    const res = await request(app).get('/sitemap.xml');
    expect(res.status).toBe(200);
    expect(res.text).not.toContain(`/category/${cat.id}-`);
  });

  test('no expone contenido detrás de sesión (/settings, /chat, /user)', async () => {
    const res = await request(app).get('/sitemap.xml');
    expect(res.text).not.toContain('/settings');
    expect(res.text).not.toContain('/chat');
    expect(res.text).not.toMatch(/\/user\//);
  });
});

describe('GET /robots.txt', () => {
  test('permite público, bloquea API y rutas privadas, apunta al sitemap', async () => {
    const res = await request(app).get('/robots.txt');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/plain/);
    expect(res.text).toContain('User-agent: *');
    expect(res.text).toContain('Allow: /');
    expect(res.text).toContain('Disallow: /api/');
    expect(res.text).toContain('Disallow: /settings');
    expect(res.text).toContain('Disallow: /user/');

    // La línea Sitemap apunta al dominio configurado y es una URL absoluta.
    expect(res.text).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
    const sitemapLine = res.text.split('\n').find((l) => l.startsWith('Sitemap:'));
    expect(sitemapLine).toBeTruthy();
    const sitemapUrl = sitemapLine.replace('Sitemap:', '').trim();
    expect(isAbsoluteHttpUrl(sitemapUrl)).toBe(true);
  });
});
