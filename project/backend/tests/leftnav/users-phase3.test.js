import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createTopic } from '../helpers.js';

const suggested = (cookie, qs = '') =>
  request(app).get(`/api/users/suggested${qs}`).set('Cookie', cookie);
const mostActive = (qs = '') =>
  request(app).get(`/api/users/most-active${qs}`);

const follow = (nickname, cookie) =>
  request(app).post(`/api/users/${nickname}/follow`).set('Cookie', cookie);

describe('GET /users/suggested', () => {
  test('requiere sesión → 401 sin cookie', async () => {
    const res = await request(app).get('/api/users/suggested');
    expect(res.status).toBe(401);
  });

  test('no me incluye a mí mismo', async () => {
    const yo = await registerAndLogin();
    await registerAndLogin(); // otro usuario para que haya sugerencias
    const res = await suggested(yo.cookie);
    const ids = res.body.data.map(u => u.id);
    expect(ids).not.toContain(yo.user.id);
  });

  test('no incluye a usuarios que ya sigo', async () => {
    const yo = await registerAndLogin();
    const otro = await registerAndLogin();
    // antes de seguir, 'otro' aparece
    let res = await suggested(yo.cookie);
    expect(res.body.data.map(u => u.id)).toContain(otro.user.id);
    // sigo a 'otro' → debe desaparecer de las sugerencias
    await follow(otro.user.nickname, yo.cookie);
    res = await suggested(yo.cookie);
    expect(res.body.data.map(u => u.id)).not.toContain(otro.user.id);
  });
});

describe('GET /users/most-active', () => {
  test('es público → 200 y array', async () => {
    const res = await mostActive();
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('ordena por aportes descendente', async () => {
    const activo = await registerAndLogin();
    const pasivo = await registerAndLogin();
    // 'activo' crea 3 temas, 'pasivo' ninguno
    await createTopic(activo.cookie, { titulo: 'T1' });
    await createTopic(activo.cookie, { titulo: 'T2' });
    await createTopic(activo.cookie, { titulo: 'T3' });

    const res = await mostActive();
    const ids = res.body.data.map(u => u.id);
    // 'activo' debe aparecer antes que 'pasivo'
    expect(ids.indexOf(activo.user.id)).toBeLessThan(ids.indexOf(pasivo.user.id));
  });
});