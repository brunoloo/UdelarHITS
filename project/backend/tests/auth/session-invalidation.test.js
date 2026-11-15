import request from 'supertest';
import app from '../../src/app.js';
import { createResetToken } from '../../src/repositories/token.repository.js';
import { registerAndLogin } from '../helpers.js';

const me = (cookie) => request(app).get('/api/users/me').set('Cookie', cookie);

const login = async ({ email, password }) => {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return res.headers['set-cookie'];
};

describe('invalidación de sesiones al cambiar la contraseña', () => {
  test('cambiar la contraseña cierra las otras sesiones y renueva la actual', async () => {
    const { cookie: actual, raw } = await registerAndLogin();
    const otra = await login(raw);
    expect((await me(otra)).status).toBe(200);

    const res = await request(app)
      .put('/api/users/change-password').set('Cookie', actual)
      .send({ currentPassword: raw.password, newPassword: 'OtraClave789' });
    expect(res.status).toBe(200);
    const renovada = res.headers['set-cookie'];
    expect(renovada).toBeDefined();

    expect((await me(otra)).status).toBe(401);
    expect((await me(actual)).status).toBe(401);
    expect((await me(renovada)).status).toBe(200);
  });

  test('restablecer la contraseña cierra las sesiones abiertas', async () => {
    const { user, cookie } = await registerAndLogin();
    expect((await me(cookie)).status).toBe(200);

    const token = 'a'.repeat(64);
    await createResetToken(user.id, token, new Date(Date.now() + 60_000));
    const res = await request(app)
      .post('/api/auth/reset-password').send({ token, newPassword: 'ClaveNueva456' });
    expect(res.status).toBe(200);

    expect((await me(cookie)).status).toBe(401);
  });
});
