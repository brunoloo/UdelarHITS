import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createCategory, createTopic } from '../helpers.js';

// ─── Metadata dinámica por ruta (inyección de <meta> en el index.html) ───
// El servidor intercepta /category/:id, /topic/:id y /user/:nickname ANTES del
// catch-all y devuelve el HTML con <title>/description/og:* reales por URL.
// Solo se expone contenido activo/público; lo inactivo/inexistente sale noindex.

// Helpers de aserción sobre el HTML crudo.
const getTag = (html, re) => (html.match(re) || [])[1];
const title = (html) => getTag(html, /<title>([\s\S]*?)<\/title>/i);
const metaName = (html, name) =>
  getTag(html, new RegExp(`<meta\\s+name=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'));
const metaProp = (html, prop) =>
  getTag(html, new RegExp(`<meta\\s+property=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i'));
const canonical = (html) =>
  getTag(html, /<link\s+rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);

describe('Metadata de categoría', () => {
  test('categoría activa: título, descripción, og:* y canonical con slug', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie, {
      titulo: 'Parciales de Logica',
      descripcion: 'Todo sobre parciales y exámenes de la materia',
    });

    const res = await request(app).get(`/category/${cat.id}-parciales-de-logica`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/html/);

    expect(title(res.text)).toBe('Parciales de Logica · UdelarHITS');
    expect(metaName(res.text, 'description')).toBe('Todo sobre parciales y exámenes de la materia');
    expect(metaName(res.text, 'robots')).toBe('index, follow');
    expect(metaProp(res.text, 'og:title')).toBe('Parciales de Logica');
    expect(metaProp(res.text, 'og:type')).toBe('website');
    expect(metaProp(res.text, 'og:site_name')).toBe('UdelarHITS');
    expect(metaName(res.text, 'twitter:card')).toBe('summary_large_image');
    expect(canonical(res.text)).toBe(`https://udelarhits.com/category/${cat.id}-parciales-de-logica`);
    expect(metaProp(res.text, 'og:url')).toBe(`https://udelarhits.com/category/${cat.id}-parciales-de-logica`);
  });

  test('escapa el contenido dinámico del usuario (anti-XSS)', async () => {
    const a = await registerAndLogin();
    const payload = '"><script>alert(1)</script> & fin';
    const cat = await createCategory(a.cookie, {
      titulo: 'Cat XSS ' + Math.random().toString(36).slice(2, 7),
      descripcion: payload,
    });

    const res = await request(app).get(`/category/${cat.id}`);
    // 301 al canónico primero; seguimos el redirect.
    const final = res.status === 301
      ? await request(app).get(res.headers.location)
      : res;

    expect(final.text).not.toContain('<script>alert(1)</script>');
    expect(final.text).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(metaName(final.text, 'description')).toContain('&amp; fin');
  });

  test('trunca descripciones largas a ~160 caracteres', async () => {
    const a = await registerAndLogin();
    const long = 'palabra '.repeat(60).trim(); // ~479 chars
    const cat = await createCategory(a.cookie, {
      titulo: 'Cat larga ' + Math.random().toString(36).slice(2, 7),
      descripcion: long,
    });

    const res = await request(app).get(`/category/${cat.id}`).redirects(1);
    const desc = metaName(res.text, 'description');
    expect(desc.length).toBeLessThanOrEqual(160);
    expect(desc.endsWith('…')).toBe(true);
  });

  test('id inexistente: HTML por defecto con noindex, status 200', async () => {
    const res = await request(app).get('/category/99999999');
    expect(res.status).toBe(200);
    expect(metaName(res.text, 'robots')).toBe('noindex, follow');
  });

  test('id no numérico: noindex (la SPA maneja su 404)', async () => {
    const res = await request(app).get('/category/no-soy-un-id');
    expect(res.status).toBe(200);
    expect(metaName(res.text, 'robots')).toBe('noindex, follow');
  });

  test('categoría inactiva: noindex', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    // Sin contenido de terceros, el delete la elimina o desactiva.
    await request(app).delete(`/api/categories/${cat.id}/delete`).set('Cookie', a.cookie);

    const res = await request(app).get(`/category/${cat.id}`);
    const final = res.status === 301 ? await request(app).get(res.headers.location) : res;
    expect(metaName(final.text, 'robots')).toBe('noindex, follow');
  });
});

describe('Metadata de tema', () => {
  test('tema activo: título con tema + categoría, og:type article', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie, { titulo: 'Cat Tema ' + Math.random().toString(36).slice(2, 6) });
    const topic = await createTopic(a.cookie, {
      categoria_id: cat.id,
      titulo: 'Como estudiar mejor',
      cuerpo: 'Cuerpo del tema con consejos de estudio',
    });
    const id = topic.id ?? topic.contenido_id;

    const res = await request(app).get(`/topic/${id}`).redirects(1);
    expect(res.status).toBe(200);
    expect(title(res.text)).toContain('Como estudiar mejor');
    expect(title(res.text)).toContain(cat.titulo);
    expect(metaProp(res.text, 'og:type')).toBe('article');
    expect(metaName(res.text, 'robots')).toBe('index, follow');
  });

  test('tema en categoría inactiva: noindex', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const topic = await createTopic(a.cookie, { categoria_id: cat.id });
    const id = topic.id ?? topic.contenido_id;
    // Inactivar la categoría directamente (contiene un tema → queda 'inactiva').
    await pool.query(`UPDATE categoria SET estado = 'inactiva' WHERE id = $1`, [cat.id]);

    const res = await request(app).get(`/topic/${id}`).redirects(1);
    expect(metaName(res.text, 'robots')).toBe('noindex, follow');
  });
});

describe('Metadata de perfil', () => {
  test('perfil activo: og:* con nickname y biografía, pero noindex', async () => {
    const a = await registerAndLogin();
    await request(app).patch('/api/users/me')
      .set('Cookie', a.cookie)
      .send({ biografia: 'Estudiante de ingeniería' });

    const res = await request(app).get(`/user/${a.user.nickname}`);
    expect(res.status).toBe(200);
    expect(metaProp(res.text, 'og:title')).toBe(a.user.nickname);
    expect(metaProp(res.text, 'og:description')).toBe('Estudiante de ingeniería');
    expect(metaProp(res.text, 'og:type')).toBe('profile');
    // Ver perfiles requiere cuenta → no se indexan.
    expect(metaName(res.text, 'robots')).toBe('noindex, follow');
  });

  test('perfil inexistente: noindex', async () => {
    const res = await request(app).get('/user/no_existe_nadie_xyz');
    expect(res.status).toBe(200);
    expect(metaName(res.text, 'robots')).toBe('noindex, follow');
  });
});

describe('Rutas noindex de la SPA', () => {
  test('/settings sirve HTML con noindex', async () => {
    const res = await request(app).get('/settings');
    expect(res.status).toBe(200);
    expect(metaName(res.text, 'robots')).toBe('noindex, follow');
  });

  test('/admin sirve HTML con noindex', async () => {
    const res = await request(app).get('/admin');
    expect(res.status).toBe(200);
    expect(metaName(res.text, 'robots')).toBe('noindex, follow');
  });
});
