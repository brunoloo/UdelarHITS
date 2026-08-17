import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createCategory, createTopic } from '../helpers.js';

// ─── sitemap.xml dinámico + robots.txt ───

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

    // URLs con slug y absolutas.
    expect(res.text).toContain(`https://udelarhits.com/category/${cat.id}-programacion-uno`);
    expect(res.text).toContain(`https://udelarhits.com/topic/${topicId}-recursion-y-punteros`);
    // lastmod presente (ISO).
    expect(res.text).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}T/);
    // Rutas estáticas públicas.
    expect(res.text).toContain('https://udelarhits.com/');
    expect(res.text).toContain('https://udelarhits.com/about');
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
    expect(res.text).toContain('Sitemap: https://udelarhits.com/sitemap.xml');
  });
});
