import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin } from '../helpers.js';

const sigue = async (seguidorId, seguidoId) => {
  const { rows } = await pool.query(
    'SELECT 1 FROM usuario_seguidor WHERE seguidor_id = $1 AND seguido_id = $2',
    [seguidorId, seguidoId]
  );
  return rows.length > 0;
};

const follow = (nickname, cookie) =>
  request(app).post(`/api/users/${nickname}/follow`).set('Cookie', cookie);
const unfollow = (nickname, cookie) =>
  request(app).delete(`/api/users/${nickname}/follow`).set('Cookie', cookie);

describe('follow / unfollow', () => {
  test('seguir a otro usuario crea la relación', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const res = await follow(b.user.nickname, a.cookie);
    expect(res.status).toBe(200);
    expect(await sigue(a.user.id, b.user.id)).toBe(true);
  });

  test('dejar de seguir elimina la relación', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    await follow(b.user.nickname, a.cookie);
    const res = await unfollow(b.user.nickname, a.cookie);
    expect(res.status).toBe(200);
    expect(await sigue(a.user.id, b.user.id)).toBe(false);
  });

  test('no podés seguirte a vos mismo → 400', async () => {
    const a = await registerAndLogin();
    const res = await follow(a.user.nickname, a.cookie);
    expect(res.status).toBe(400);
    expect(await sigue(a.user.id, a.user.id)).toBe(false);
  });

  test('seguir dos veces es idempotente (no duplica, no falla)', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    await follow(b.user.nickname, a.cookie);
    const res = await follow(b.user.nickname, a.cookie);  // segunda vez
    expect(res.status).toBe(200);  // no 500
    // sigue habiendo exactamente una relación
    const { rows } = await pool.query(
      'SELECT COUNT(*)::int AS n FROM usuario_seguidor WHERE seguidor_id = $1 AND seguido_id = $2',
      [a.user.id, b.user.id]
    );
    expect(rows[0].n).toBe(1);
  });

  test('seguir a un usuario inexistente → 404', async () => {
    const a = await registerAndLogin();
    const res = await follow('noexiste_xyz', a.cookie);
    expect(res.status).toBe(404);
  });

  test('dejar de seguir a alguien que no seguís no falla → 200', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const res = await unfollow(b.user.nickname, a.cookie);
    expect(res.status).toBe(200);
  });

  test('seguir sin sesión → 401', async () => {
    const b = await registerAndLogin();
    const res = await request(app).post(`/api/users/${b.user.nickname}/follow`);
    expect(res.status).toBe(401);
  });

  test('los contadores del perfil reflejan los seguidores reales', async () => {
    const objetivo = await registerAndLogin();
    const seg1 = await registerAndLogin();
    const seg2 = await registerAndLogin();

    // dos usuarios siguen a 'objetivo'
    await follow(objetivo.user.nickname, seg1.cookie);
    await follow(objetivo.user.nickname, seg2.cookie);

    // el perfil de 'objetivo' debe mostrar 2 seguidores
    const res = await request(app)
      .get(`/api/users/${objetivo.user.nickname}`)
      .set('Cookie', seg1.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.followers).toHaveLength(2);
  });
});