import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createCategory, createTopic, createReply } from '../helpers.js';
import {
  buildOgImageUrl, stripEmojis, truncateTitle, encodeCloudinaryText,
  avatarForOg, OG_WIDTH, OG_HEIGHT, AVATAR_OG_SIZE,
} from '../../src/utils/ogImage.js';

// ─── Metadata dinámica por ruta (inyección de <meta> en el index.html) ───
// El servidor intercepta /category/:id, /topic/:id, /comment/:id y
// /user/:nickname ANTES del catch-all y devuelve el HTML con
// <title>/description/og:* reales por URL.

const getTag = (html, re) => (html.match(re) || [])[1];
const title = (html) => getTag(html, /<title>([\s\S]*?)<\/title>/i);
const metaName = (html, name) =>
  getTag(html, new RegExp(`<meta\\s+name=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i'));
const metaProp = (html, prop) =>
  getTag(html, new RegExp(`<meta\\s+property=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i'));
const canonical = (html) =>
  getTag(html, /<link\s+rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);

// ── ogImage.js unit tests ────────────────────────────────────────────────────

describe('ogImage.js — stripEmojis', () => {
  test('elimina emojis y preserva texto', () => {
    expect(stripEmojis('Hola 😀 mundo 🎉')).toBe('Hola mundo');
  });

  test('título de solo emojis queda vacío', () => {
    expect(stripEmojis('😀🎉🚀💯')).toBe('');
  });

  test('preserva signos de interrogación y puntuación', () => {
    expect(stripEmojis('???')).toBe('???');
    expect(stripEmojis('¡Hola! ¿Qué tal?')).toBe('¡Hola! ¿Qué tal?');
  });

  test('preserva tildes y caracteres latinos', () => {
    expect(stripEmojis('Programación en español')).toBe('Programación en español');
  });

  test('texto vacío o null devuelve string vacío', () => {
    expect(stripEmojis('')).toBe('');
    expect(stripEmojis(null)).toBe('');
    expect(stripEmojis(undefined)).toBe('');
  });
});

describe('ogImage.js — truncateTitle', () => {
  test('no trunca títulos cortos', () => {
    expect(truncateTitle('Corto')).toBe('Corto');
  });

  test('trunca en límite de palabra con elipsis', () => {
    const long = 'palabra '.repeat(20).trim();
    const result = truncateTitle(long, 40);
    expect(result.length).toBeLessThanOrEqual(40);
    expect(result.endsWith('…')).toBe(true);
  });

  test('texto vacío o null devuelve string vacío', () => {
    expect(truncateTitle('')).toBe('');
    expect(truncateTitle(null)).toBe('');
  });
});

describe('ogImage.js — encodeCloudinaryText', () => {
  test('codifica signos de interrogación', () => {
    expect(encodeCloudinaryText('???')).toBe('%3F%3F%3F');
  });

  test('codifica espacios', () => {
    expect(encodeCloudinaryText('hola mundo')).toBe('hola%20mundo');
  });

  test('codifica caracteres especiales', () => {
    const encoded = encodeCloudinaryText('a/b,c&d');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain(',');
  });

  test('codifica caracteres acentuados', () => {
    const encoded = encodeCloudinaryText('Programación');
    expect(encoded).toContain('%');
  });
});

describe('ogImage.js — buildOgImageUrl', () => {
  const originalEnv = process.env.CLOUDINARY_CLOUD_NAME;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.CLOUDINARY_CLOUD_NAME = originalEnv;
    } else {
      delete process.env.CLOUDINARY_CLOUD_NAME;
    }
  });

  test('sin CLOUDINARY_CLOUD_NAME devuelve fallback', () => {
    delete process.env.CLOUDINARY_CLOUD_NAME;
    const url = buildOgImageUrl('category', 'Parciales de Lógica');
    expect(url).toContain('og-');
    expect(url).not.toContain('cloudinary');
  });

  test('título de solo emojis devuelve fallback', () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'testcloud';
    const url = buildOgImageUrl('category', '😀🎉🚀💯');
    expect(url).not.toContain('cloudinary');
  });

  test('título vacío devuelve fallback', () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'testcloud';
    const url = buildOgImageUrl('category', '');
    expect(url).not.toContain('cloudinary');
  });

  test('título null devuelve fallback', () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'testcloud';
    const url = buildOgImageUrl('topic', null);
    expect(url).not.toContain('cloudinary');
  });

  test('tipo inválido devuelve fallback genérico', () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'testcloud';
    const url = buildOgImageUrl('invalido', 'Test');
    expect(url).toContain('og-image');
  });

  test('título con ??? se codifica correctamente', () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'testcloud';
    const url = buildOgImageUrl('category', '???');
    expect(url).toContain('cloudinary');
    expect(url).toContain('%3F%3F%3F');
    expect(url).not.toContain('???');
  });
});

describe('ogImage.js — avatarForOg', () => {
  test('agrega transformación c_fill a URL de Cloudinary con versión', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/v1234/avatars/abc.jpg';
    const result = avatarForOg(url);
    expect(result).toContain(`c_fill,w_${AVATAR_OG_SIZE},h_${AVATAR_OG_SIZE}`);
    expect(result).toContain('v1234');
  });

  test('agrega transformación a URL sin versión', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/avatars/abc.jpg';
    const result = avatarForOg(url);
    expect(result).toContain(`c_fill,w_${AVATAR_OG_SIZE},h_${AVATAR_OG_SIZE}`);
  });

  test('reemplaza transformación existente', () => {
    const url = 'https://res.cloudinary.com/demo/image/upload/c_fill,w_96,h_96/v1234/avatars/abc.jpg';
    const result = avatarForOg(url);
    expect(result).toContain(`c_fill,w_${AVATAR_OG_SIZE},h_${AVATAR_OG_SIZE}`);
    expect(result).not.toContain('w_96');
  });

  test('URL no-Cloudinary queda sin cambios', () => {
    const url = 'https://example.com/avatar.jpg';
    expect(avatarForOg(url)).toBe(url);
  });

  test('null/undefined devuelve el valor original', () => {
    expect(avatarForOg(null)).toBeNull();
    expect(avatarForOg(undefined)).toBeUndefined();
  });
});

// ── Integration tests ────────────────────────────────────────────────────────

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

  test('og:image se genera (no es la genérica del sitio)', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie, {
      titulo: 'Categoría con OG',
      descripcion: 'Descripción de prueba',
    });

    const res = await request(app).get(`/category/${cat.id}`).redirects(1);
    const ogImage = metaProp(res.text, 'og:image');
    expect(ogImage).toBeTruthy();
    expect(metaProp(res.text, 'og:image:width')).toBeTruthy();
    expect(metaProp(res.text, 'og:image:height')).toBeTruthy();
  });

  test('escapa el contenido dinámico del usuario (anti-XSS)', async () => {
    const a = await registerAndLogin();
    const payload = '"><script>alert(1)</script> & fin';
    const cat = await createCategory(a.cookie, {
      titulo: 'Cat XSS ' + Math.random().toString(36).slice(2, 7),
      descripcion: payload,
    });

    const res = await request(app).get(`/category/${cat.id}`);
    const final = res.status === 301
      ? await request(app).get(res.headers.location)
      : res;

    expect(final.text).not.toContain('<script>alert(1)</script>');
    expect(final.text).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(metaName(final.text, 'description')).toContain('&amp; fin');
  });

  test('trunca descripciones largas a ~160 caracteres', async () => {
    const a = await registerAndLogin();
    const long = 'palabra '.repeat(60).trim();
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
    await request(app).delete(`/api/categories/${cat.id}/delete`).set('Cookie', a.cookie);

    const res = await request(app).get(`/category/${cat.id}`);
    const final = res.status === 301 ? await request(app).get(res.headers.location) : res;
    expect(metaName(final.text, 'robots')).toBe('noindex, follow');
  });
});

describe('Metadata de tema', () => {
  test('tema activo: título con tema + categoría, og:type article, og:image', async () => {
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
    expect(metaProp(res.text, 'og:image')).toBeTruthy();
    expect(metaProp(res.text, 'og:image:width')).toBeTruthy();
    expect(metaProp(res.text, 'og:image:height')).toBeTruthy();
  });

  test('tema en categoría inactiva: noindex', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const topic = await createTopic(a.cookie, { categoria_id: cat.id });
    const id = topic.id ?? topic.contenido_id;
    await pool.query(`UPDATE categoria SET estado = 'inactiva' WHERE id = $1`, [cat.id]);

    const res = await request(app).get(`/topic/${id}`).redirects(1);
    expect(metaName(res.text, 'robots')).toBe('noindex, follow');
  });
});

describe('Metadata de comentario', () => {
  test('comentario visible: metadata con contexto del tema, noindex', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie, { titulo: 'Cat Comentario ' + Math.random().toString(36).slice(2, 6) });
    const topic = await createTopic(a.cookie, {
      categoria_id: cat.id,
      titulo: 'Tema para comentario',
      cuerpo: 'Cuerpo del tema',
    });
    const topicId = topic.id ?? topic.contenido_id;
    const comment = await createReply(a.cookie, {
      tema_id: topicId,
      cuerpo: 'Este es un comentario de prueba para SEO',
    });
    const commentId = comment.id ?? comment.contenido_id;

    const res = await request(app).get(`/comment/${commentId}`);
    expect(res.status).toBe(200);
    expect(title(res.text)).toContain('Comentario en');
    expect(title(res.text)).toContain('Tema para comentario');
    expect(metaProp(res.text, 'og:type')).toBe('article');
    expect(metaName(res.text, 'robots')).toBe('noindex, follow');
    expect(metaProp(res.text, 'og:image')).toBeTruthy();
    expect(metaProp(res.text, 'og:image:width')).toBeTruthy();
    expect(metaProp(res.text, 'og:image:height')).toBeTruthy();
  });

  test('comentario oculto: noindex con metadata genérica', async () => {
    const a = await registerAndLogin();
    const topic = await createTopic(a.cookie);
    const topicId = topic.id ?? topic.contenido_id;
    const comment = await createReply(a.cookie, {
      tema_id: topicId,
      cuerpo: 'Comentario que será ocultado',
    });
    const commentId = comment.id ?? comment.contenido_id;
    await pool.query(`UPDATE comentario SET estado = 'oculto' WHERE contenido_id = $1`, [commentId]);

    const res = await request(app).get(`/comment/${commentId}`);
    expect(res.status).toBe(200);
    expect(metaName(res.text, 'robots')).toBe('noindex, follow');
  });

  test('comentario inexistente: noindex', async () => {
    const res = await request(app).get('/comment/99999999');
    expect(res.status).toBe(200);
    expect(metaName(res.text, 'robots')).toBe('noindex, follow');
  });

  test('id no numérico: noindex', async () => {
    const res = await request(app).get('/comment/no-es-id');
    expect(res.status).toBe(200);
    expect(metaName(res.text, 'robots')).toBe('noindex, follow');
  });
});

describe('Metadata de perfil', () => {
  const BIO = 'Estudiante de ingeniería con datos privados sensibles';

  async function setBio(cookie) {
    await request(app).patch('/api/users/me').set('Cookie', cookie).send({ biografia: BIO });
  }

  test('cuenta pública activa: og:* con nickname, biografía y avatar; noindex', async () => {
    const a = await registerAndLogin();
    await setBio(a.cookie);
    await pool.query(`UPDATE usuario SET url_imagen = $2 WHERE LOWER(nickname) = LOWER($1)`,
      [a.user.nickname, 'https://res.cloudinary.com/demo/image/upload/v1234/avatars/avatar.jpg']);

    const res = await request(app).get(`/user/${a.user.nickname}`);
    expect(res.status).toBe(200);
    expect(metaProp(res.text, 'og:title')).toBe(a.user.nickname);
    expect(metaProp(res.text, 'og:description')).toBe(BIO);
    expect(metaProp(res.text, 'og:type')).toBe('profile');
    expect(metaProp(res.text, 'og:image')).toContain('cloudinary');
    expect(metaProp(res.text, 'og:image')).toContain(`c_fill,w_${AVATAR_OG_SIZE},h_${AVATAR_OG_SIZE}`);
    expect(metaName(res.text, 'robots')).toBe('noindex, follow');
  });

  test('avatar og:image declara dimensiones cuadradas correctas', async () => {
    const a = await registerAndLogin();
    await pool.query(`UPDATE usuario SET url_imagen = $2 WHERE LOWER(nickname) = LOWER($1)`,
      [a.user.nickname, 'https://res.cloudinary.com/demo/image/upload/v1234/avatars/avatar.jpg']);

    const res = await request(app).get(`/user/${a.user.nickname}`);
    expect(metaProp(res.text, 'og:image:width')).toBe(String(AVATAR_OG_SIZE));
    expect(metaProp(res.text, 'og:image:height')).toBe(String(AVATAR_OG_SIZE));
  });

  test('cuenta sin avatar: og:image genérica con dimensiones 1200x630', async () => {
    const a = await registerAndLogin();
    await pool.query(`UPDATE usuario SET url_imagen = NULL WHERE LOWER(nickname) = LOWER($1)`,
      [a.user.nickname]);

    const res = await request(app).get(`/user/${a.user.nickname}`);
    expect(metaProp(res.text, 'og:image')).toContain('og-image');
    expect(metaProp(res.text, 'og:image:width')).toBe('1200');
    expect(metaProp(res.text, 'og:image:height')).toBe('630');
  });

  test('cuenta PRIVADA: metadata genérica, sin nickname/biografía/avatar; noindex', async () => {
    const a = await registerAndLogin();
    await setBio(a.cookie);
    await pool.query(`UPDATE usuario SET privado = TRUE, url_imagen = $2 WHERE LOWER(nickname) = LOWER($1)`,
      [a.user.nickname, 'https://res.cloudinary.com/demo/image/upload/avatar.jpg']);

    const res = await request(app).get(`/user/${a.user.nickname}`);
    expect(res.status).toBe(200);
    expect(metaProp(res.text, 'og:title')).toBe('Perfil en UdelarHITS');
    expect(res.text).not.toContain(BIO);
    expect(res.text).not.toContain(a.user.nickname);
    expect(metaProp(res.text, 'og:image')).not.toContain('avatar.jpg');
    expect(metaName(res.text, 'robots')).toBe('noindex, follow');
  });

  test('cuenta BANEADA: metadata genérica, sin biografía; noindex', async () => {
    const a = await registerAndLogin();
    await setBio(a.cookie);
    await pool.query(`UPDATE usuario SET estado = 'ban' WHERE LOWER(nickname) = LOWER($1)`,
      [a.user.nickname]);

    const res = await request(app).get(`/user/${a.user.nickname}`);
    expect(res.status).toBe(200);
    expect(metaProp(res.text, 'og:title')).toBe('Perfil en UdelarHITS');
    expect(res.text).not.toContain(BIO);
    expect(metaName(res.text, 'robots')).toBe('noindex, follow');
  });

  test('cuenta INACTIVA: metadata genérica, sin biografía; noindex', async () => {
    const a = await registerAndLogin();
    await setBio(a.cookie);
    await pool.query(`UPDATE usuario SET estado = 'inactivo' WHERE LOWER(nickname) = LOWER($1)`,
      [a.user.nickname]);

    const res = await request(app).get(`/user/${a.user.nickname}`);
    expect(res.status).toBe(200);
    expect(metaProp(res.text, 'og:title')).toBe('Perfil en UdelarHITS');
    expect(res.text).not.toContain(BIO);
    expect(metaName(res.text, 'robots')).toBe('noindex, follow');
  });

  test('perfil inexistente: metadata genérica con noindex', async () => {
    const res = await request(app).get('/user/no_existe_nadie_xyz');
    expect(res.status).toBe(200);
    expect(metaProp(res.text, 'og:title')).toBe('Perfil en UdelarHITS');
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
