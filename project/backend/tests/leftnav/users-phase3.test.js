import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createTopic, createHomeReply } from '../helpers.js';

const suggested = (cookie, qs = '') =>
  request(app).get(`/api/users/suggested${qs}`).set('Cookie', cookie);
// Misma ruta pero sin cookie: el endpoint es optionalAuth.
const suggestedGuest = (qs = '') =>
  request(app).get(`/api/users/suggested${qs}`);
const mostActive = (qs = '') =>
  request(app).get(`/api/users/most-active${qs}`);

const follow = (nickname, cookie) =>
  request(app).post(`/api/users/${nickname}/follow`).set('Cookie', cookie);

describe('GET /users/suggested', () => {
  test('sin cookie → 200 y array de usuarios', async () => {
    const res = await suggestedGuest();
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
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

  // ── Variante invitado (sin sesión): usuarios activos al azar, filtrados por
  // "al menos un aporte visible". ──

  test('invitado: solo devuelve usuarios con al menos un aporte visible', async () => {
    const vacio = await registerAndLogin();              // sin aportes
    const conTema = await registerAndLogin();
    const conComentario = await registerAndLogin();
    await createTopic(conTema.cookie, { titulo: 'Tema visible' });
    await createHomeReply(conComentario.cookie);

    const res = await suggestedGuest();
    expect(res.status).toBe(200);
    const ids = res.body.data.map(u => u.id);
    expect(ids).toContain(conTema.user.id);
    expect(ids).toContain(conComentario.user.id);
    expect(ids).not.toContain(vacio.user.id);
  });

  test('invitado: respeta ?limit y lo mantiene capado en 20', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const c = await registerAndLogin();
    await createTopic(a.cookie, { titulo: 'TA' });
    await createHomeReply(b.cookie);
    await createHomeReply(c.cookie);

    const res12 = await suggestedGuest('?limit=12');
    expect(res12.status).toBe(200);
    expect(res12.body.data.length).toBeLessThanOrEqual(12);

    // El clamp inferior se ve con limit=1 (hay 3 candidatos, devuelve 1).
    const res1 = await suggestedGuest('?limit=1');
    expect(res1.body.data).toHaveLength(1);

    // Y el superior: pedir 100 nunca devuelve más de 20.
    const res100 = await suggestedGuest('?limit=100');
    expect(res100.body.data.length).toBeLessThanOrEqual(20);
  });

  test('invitado: no incluye usuarios con estado distinto de activo', async () => {
    const baneado = await registerAndLogin();
    await createTopic(baneado.cookie, { titulo: 'Tema de baneado' });
    // Aporta contenido pero la cuenta deja de estar activa.
    await pool.query(`UPDATE usuario SET estado = 'ban' WHERE id = $1`, [baneado.user.id]);

    const res = await suggestedGuest();
    expect(res.body.data.map(u => u.id)).not.toContain(baneado.user.id);
  });

  test('invitado: un perfil privado sí aparece (deliberado)', async () => {
    const privado = await registerAndLogin();
    await createTopic(privado.cookie, { titulo: 'Tema de privado' });
    await pool.query(`UPDATE usuario SET privado = TRUE WHERE id = $1`, [privado.user.id]);

    const res = await suggestedGuest();
    expect(res.body.data.map(u => u.id)).toContain(privado.user.id);
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
