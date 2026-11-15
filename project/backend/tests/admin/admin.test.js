import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createAdmin } from '../helpers.js';

const estadoUsuario = async (id) => {
  const { rows } = await pool.query('SELECT estado FROM usuario WHERE id = $1', [id]);
  return rows[0]?.estado ?? null;
};

const ban = (nickname, cookie) =>
  request(app).patch(`/api/users/${nickname}/ban`).set('Cookie', cookie);
const activar = (nickname, cookie) =>
  request(app).patch(`/api/users/${nickname}/active`).set('Cookie', cookie);

describe('ban / active (admin)', () => {
  test('un admin puede banear a un usuario', async () => {
    const admin = await createAdmin();
    const victima = await registerAndLogin();
    const res = await ban(victima.user.nickname, admin.cookie);
    expect(res.status).toBe(200);
    expect(await estadoUsuario(victima.user.id)).toBe('ban');
  });

  test('un admin puede reactivar a un usuario baneado', async () => {
    const admin = await createAdmin();
    const victima = await registerAndLogin();
    await ban(victima.user.nickname, admin.cookie);
    const res = await activar(victima.user.nickname, admin.cookie);
    expect(res.status).toBe(200);
    expect(await estadoUsuario(victima.user.id)).toBe('activo');
  });

  test('un usuario normal NO puede banear → 403', async () => {
    const normal = await registerAndLogin();
    const otro = await registerAndLogin();
    const res = await ban(otro.user.nickname, normal.cookie);
    expect(res.status).toBe(403);
    // y el estado de la víctima no cambió
    expect(await estadoUsuario(otro.user.id)).toBe('activo');
  });

  test('banear sin sesión → 401', async () => {
    const victima = await registerAndLogin();
    const res = await request(app).patch(`/api/users/${victima.user.nickname}/ban`);
    expect(res.status).toBe(401);
  });

  test('banear a un usuario inexistente → 404', async () => {
    const admin = await createAdmin();
    const res = await ban('noexiste_xyz', admin.cookie);
    expect(res.status).toBe(404);
  });
});

describe('login de usuario baneado', () => {
  test('un usuario baneado no puede iniciar sesión → 403', async () => {
    const admin = await createAdmin();
    const victima = await registerAndLogin();

    const b = await ban(victima.user.nickname, admin.cookie);
    expect(b.status).toBe(200);
    expect(await estadoUsuario(victima.user.id)).toBe('ban');

    const login = await request(app).post('/api/auth/login')
      .send({ email: victima.raw.email, password: victima.raw.password });
    expect(login.status).toBe(403);
  });
});