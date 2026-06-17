import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin } from '../helpers.js';

describe('PUT /api/users/change-password', () => {

  // ── Sin autenticación ──────────────────────────────────
  it('rechaza sin sesión (401)', async () => {
    const res = await request(app)
      .put('/api/users/change-password')
      .send({ currentPassword: 'Password123', newPassword: 'NuevaPass456' });

    expect(res.status).toBe(401);
  });

  // ── Campos faltantes ───────────────────────────────────
  it('rechaza si falta currentPassword (400)', async () => {
    const { cookie } = await registerAndLogin();

    const res = await request(app)
      .put('/api/users/change-password')
      .set('Cookie', cookie)
      .send({ newPassword: 'NuevaPass456' });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  it('rechaza si falta newPassword (400)', async () => {
    const { cookie } = await registerAndLogin();

    const res = await request(app)
      .put('/api/users/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'Password123' });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  // ── Contraseña actual incorrecta ───────────────────────
  it('rechaza si la contraseña actual es incorrecta (401)', async () => {
    const { cookie } = await registerAndLogin();

    const res = await request(app)
      .put('/api/users/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'Incorrecta999', newPassword: 'NuevaPass456' });

    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  // ── Nueva contraseña demasiado corta ───────────────────
  it('rechaza si la nueva contraseña tiene menos de 8 caracteres (400)', async () => {
    const { cookie } = await registerAndLogin();

    const res = await request(app)
      .put('/api/users/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'Password123', newPassword: 'corta' });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  // ── Cambio exitoso ─────────────────────────────────────
  it('cambia la contraseña correctamente (200)', async () => {
    const { cookie, raw } = await registerAndLogin();

    const res = await request(app)
      .put('/api/users/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: raw.password, newPassword: 'NuevaSegura99' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  // ── Login con la contraseña nueva funciona ─────────────
  it('permite login con la nueva contraseña después del cambio', async () => {
    const { cookie, raw } = await registerAndLogin();

    await request(app)
      .put('/api/users/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: raw.password, newPassword: 'NuevaSegura99' });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: raw.email, password: 'NuevaSegura99' });

    expect(login.status).toBe(200);
    expect(login.body.ok).toBe(true);
  });

  // ── Login con la contraseña vieja falla ────────────────
  it('rechaza login con la contraseña vieja después del cambio', async () => {
    const { cookie, raw } = await registerAndLogin();

    await request(app)
      .put('/api/users/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: raw.password, newPassword: 'NuevaSegura99' });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: raw.email, password: raw.password });

    expect(login.status).toBe(401);
  });

  // ── Cambio doble (encadenado) ──────────────────────────
  it('permite cambiar la contraseña dos veces seguidas', async () => {
    const { cookie, raw } = await registerAndLogin();

    // Primer cambio
    await request(app)
      .put('/api/users/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: raw.password, newPassword: 'Segunda123' });

    // Segundo cambio (con la nueva sesión porque la cookie JWT sigue válida)
    const res = await request(app)
      .put('/api/users/change-password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'Segunda123', newPassword: 'Tercera456' });

    expect(res.status).toBe(200);

    // Login con la última
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: raw.email, password: 'Tercera456' });

    expect(login.status).toBe(200);
  });
});