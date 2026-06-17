import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin } from '../helpers.js';

describe('PATCH /api/users/me/privacy', () => {

  // ── Sin autenticación ──────────────────────────────────
  it('rechaza sin sesión (401)', async () => {
    const res = await request(app)
      .patch('/api/users/me/privacy')
      .send({});

    expect(res.status).toBe(401);
  });

  // ── Toggle a privado ───────────────────────────────────
  it('cambia a privado si estaba público (200)', async () => {
    const { cookie } = await registerAndLogin();

    const res = await request(app)
      .patch('/api/users/me/privacy')
      .set('Cookie', cookie)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.privado).toBe(true);
  });

  // ── Toggle de vuelta a público ─────────────────────────
  it('cambia a público si estaba privado (200)', async () => {
    const { cookie } = await registerAndLogin();

    // Primer toggle → privado
    await request(app)
      .patch('/api/users/me/privacy')
      .set('Cookie', cookie)
      .send({});

    // Segundo toggle → público
    const res = await request(app)
      .patch('/api/users/me/privacy')
      .set('Cookie', cookie)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.privado).toBe(false);
  });

  // ── Estado persiste en BD ──────────────────────────────
  it('persiste el estado en la BD', async () => {
    const { cookie, user } = await registerAndLogin();

    await request(app)
      .patch('/api/users/me/privacy')
      .set('Cookie', cookie)
      .send({});

    const { rows } = await pool.query(
      'SELECT privado FROM usuario WHERE id = $1', [user.id]
    );

    expect(rows[0].privado).toBe(true);
  });

  // ── /me devuelve el campo privado ──────────────────────
  it('/me incluye el campo privado', async () => {
    const { cookie } = await registerAndLogin();

    // Toggle a privado
    await request(app)
      .patch('/api/users/me/privacy')
      .set('Cookie', cookie)
      .send({});

    const me = await request(app)
      .get('/api/users/me')
      .set('Cookie', cookie);

    expect(me.body.data.user.privado).toBe(true);
  });

  // ── Perfil público sigue mostrando datos ───────────────
  it('el perfil público devuelve datos normalmente', async () => {
    const userA = await registerAndLogin();
    const userB = await registerAndLogin();

    const profile = await request(app)
      .get(`/api/users/${userA.user.nickname}`)
      .set('Cookie', userB.cookie);

    expect(profile.status).toBe(200);
    expect(profile.body.data.user.nickname).toBe(userA.user.nickname);
  });
}); 