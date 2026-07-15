import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createCategory } from '../helpers.js';

// ─── /users/me (liviano) vs /users/me/full ───
// /users/me es la request de arranque de la app: devuelve SOLO el objeto user.
// Las listas (categorías propias, seguidores, seguidos) viven en /users/me/full,
// que consume la página de perfil propio.

describe('GET /users/me (liviano)', () => {
  test('devuelve el user completo (email, tiene_password) sin las listas', async () => {
    const me = await registerAndLogin();
    const res = await request(app).get('/api/users/me').set('Cookie', me.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.user.nickname).toBe(me.user.nickname);
    expect(res.body.data.user.email).toBe(me.raw.email.toLowerCase());
    expect(res.body.data.user).toHaveProperty('tiene_password', true);
    // Forma liviana: sin listas.
    expect(res.body.data).not.toHaveProperty('categories');
    expect(res.body.data).not.toHaveProperty('followers');
    expect(res.body.data).not.toHaveProperty('following');
  });
});

describe('GET /users/me/full', () => {
  test('sin cookie → 401', async () => {
    const res = await request(app).get('/api/users/me/full');
    expect(res.status).toBe(401);
  });

  test('devuelve user + categorías propias + seguidores + seguidos', async () => {
    const me = await registerAndLogin();
    const cat = await createCategory(me.cookie);

    const fan = await registerAndLogin();
    await request(app)
      .post(`/api/users/${encodeURIComponent(me.user.nickname)}/follow`)
      .set('Cookie', fan.cookie);

    const res = await request(app).get('/api/users/me/full').set('Cookie', me.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.user.nickname).toBe(me.user.nickname);
    expect(res.body.data.categories.map(c => c.id)).toContain(cat.id);
    expect(res.body.data.followers.map(f => f.nickname)).toContain(fan.user.nickname);
    expect(Array.isArray(res.body.data.following)).toBe(true);
  });
});
