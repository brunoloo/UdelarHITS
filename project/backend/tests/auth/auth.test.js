import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, makeUser } from '../helpers.js';

test('register devuelve éxito', async () => {
  const res = await request(app).post('/api/auth/register').send(makeUser());
  expect(res.status).toBeLessThan(400);
  expect(res.body.ok).toBe(true);
});

test('login devuelve cookie jwt y datos del usuario', async () => {
  const { user, cookie } = await registerAndLogin();
  expect(cookie).toBeDefined();
  expect(String(cookie)).toMatch(/jwt=/);
  expect(user).toHaveProperty('id');
  expect(user).toHaveProperty('nickname');
});

test('una ruta protegida acepta la cookie del login', async () => {
  const { cookie } = await registerAndLogin();
  const res = await request(app).get('/api/users/me').set('Cookie', cookie);
  expect(res.status).toBe(200);
  expect(res.body.data.user).toHaveProperty('nickname');
});

test('una ruta protegida sin cookie devuelve 401', async () => {
  const res = await request(app).get('/api/users/me');
  expect(res.status).toBe(401);
});