import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin } from '../helpers.js';

describe('POST /api/users/me/deactivate', () => {

  // ── Sin autenticación ──────────────────────────────────
  it('rechaza sin sesión (401)', async () => {
    const res = await request(app)
      .post('/api/users/me/deactivate')
      .send({ password: 'Password123' });

    expect(res.status).toBe(401);
  });

  // ── Campos faltantes ───────────────────────────────────
  it('rechaza si falta password (400)', async () => {
    const { cookie } = await registerAndLogin();

    const res = await request(app)
      .post('/api/users/me/deactivate')
      .set('Cookie', cookie)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  // ── Contraseña incorrecta ──────────────────────────────
  it('rechaza si la contraseña es incorrecta (401)', async () => {
    const { cookie } = await registerAndLogin();

    const res = await request(app)
      .post('/api/users/me/deactivate')
      .set('Cookie', cookie)
      .send({ password: 'Incorrecta999' });

    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  // ── Desactivación exitosa ──────────────────────────────
  it('desactiva la cuenta correctamente (200)', async () => {
    const { cookie, raw } = await registerAndLogin();

    const res = await request(app)
      .post('/api/users/me/deactivate')
      .set('Cookie', cookie)
      .send({ password: raw.password });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  // ── Estado en la BD ────────────────────────────────────
  it('cambia el estado a inactivo en la BD', async () => {
    const { cookie, raw, user } = await registerAndLogin();

    await request(app)
      .post('/api/users/me/deactivate')
      .set('Cookie', cookie)
      .send({ password: raw.password });

    const { rows } = await pool.query(
      `SELECT estado, url_imagen, url_banner, biografia FROM usuario WHERE id = $1`,
      [user.id]
    );

    expect(rows[0].estado).toBe('inactivo');
    expect(rows[0].url_imagen).toBeNull();
    expect(rows[0].url_banner).toBeNull();
    expect(rows[0].biografia).toBeNull();
  });

  // ── No puede loguearse después ─────────────────────────
  it('no permite login después de desactivar', async () => {
    const { cookie, raw } = await registerAndLogin();

    await request(app)
      .post('/api/users/me/deactivate')
      .set('Cookie', cookie)
      .send({ password: raw.password });

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: raw.email, password: raw.password });

    expect(login.status).toBe(403);
  });

  // ── Seguidores se limpian ──────────────────────────────
  it('limpia las relaciones de seguimiento', async () => {
    const userA = await registerAndLogin();
    const userB = await registerAndLogin();

    // A sigue a B
    await request(app)
      .post(`/api/users/${userB.user.nickname}/follow`)
      .set('Cookie', userA.cookie);

    // B sigue a A
    await request(app)
      .post(`/api/users/${userA.user.nickname}/follow`)
      .set('Cookie', userB.cookie);

    // A desactiva su cuenta
    await request(app)
      .post('/api/users/me/deactivate')
      .set('Cookie', userA.cookie)
      .send({ password: userA.raw.password });

    // Verificar que no hay relaciones de seguimiento para A
    const { rows } = await pool.query(
      `SELECT * FROM usuario_seguidor WHERE seguidor_id = $1 OR seguido_id = $1`,
      [userA.user.id]
    );

    expect(rows.length).toBe(0);
  });

  // ── No aparece en búsqueda ─────────────────────────────
  it('no aparece en la búsqueda de usuarios', async () => {
    const { cookie, raw, user } = await registerAndLogin();

    await request(app)
      .post('/api/users/me/deactivate')
      .set('Cookie', cookie)
      .send({ password: raw.password });

    const search = await request(app)
      .get(`/api/users/search?q=${user.nickname}`);

    const found = search.body.data.some(u => u.nickname === user.nickname);
    expect(found).toBe(false);
  });

  // ── Nickname y email se preservan ──────────────────────
  it('preserva nickname y email en la BD para reactivación', async () => {
    const { cookie, raw, user } = await registerAndLogin();

    await request(app)
      .post('/api/users/me/deactivate')
      .set('Cookie', cookie)
      .send({ password: raw.password });

    const { rows } = await pool.query(
      `SELECT nickname, email, password_hash FROM usuario WHERE id = $1`,
      [user.id]
    );

    expect(rows[0].nickname).toBe(user.nickname);
    expect(rows[0].email).toBe(raw.email.toLowerCase());
    expect(rows[0].password_hash).toBeTruthy();
  });

  // ── Admin puede reactivar ──────────────────────────────
  it('el admin puede reactivar una cuenta inactiva', async () => {
    const { cookie, raw, user } = await registerAndLogin();
    const admin = await registerAndLogin();

    // Hacer admin manualmente
    await pool.query(`UPDATE usuario SET rol = 'admin' WHERE id = $1`, [admin.user.id]);

    // Reloguear para refrescar cookie con rol admin
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: admin.raw.email, password: admin.raw.password });
    const adminCookie = adminLogin.headers['set-cookie'];

    // Desactivar cuenta
    await request(app)
      .post('/api/users/me/deactivate')
      .set('Cookie', cookie)
      .send({ password: raw.password });

    // Admin reactiva
    const reactivate = await request(app)
      .patch(`/api/users/${user.nickname}/active`)
      .set('Cookie', adminCookie);

    expect(reactivate.status).toBe(200);

    // Puede loguearse de nuevo
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: raw.email, password: raw.password });

    expect(login.status).toBe(200);
  });

  it('rechaza requests autenticadas con sesión previa después de desactivar', async () => {
  const { cookie, raw } = await registerAndLogin();

  // Desactivar cuenta
  await request(app)
    .post('/api/users/me/deactivate')
    .set('Cookie', cookie)
    .send({ password: raw.password });

  // Intentar usar la misma cookie para un request autenticado
  const me = await request(app)
    .get('/api/users/me')
    .set('Cookie', cookie);

  expect(me.status).toBe(403);
});
  
});