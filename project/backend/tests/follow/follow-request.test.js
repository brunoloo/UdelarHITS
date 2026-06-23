import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin } from '../helpers.js';

// Marca una cuenta como privada directo en la BD.
const makePrivate = (userId) =>
  pool.query('UPDATE usuario SET privado = TRUE WHERE id = $1', [userId]);

// Estado de la fila de seguimiento (o null si no existe).
const followState = async (seguidorId, seguidoId) => {
  const { rows } = await pool.query(
    'SELECT estado FROM usuario_seguidor WHERE seguidor_id = $1 AND seguido_id = $2',
    [seguidorId, seguidoId]
  );
  return rows[0]?.estado ?? null;
};

const follow = (nickname, cookie) =>
  request(app).post(`/api/users/${nickname}/follow`).set('Cookie', cookie);
const unfollow = (nickname, cookie) =>
  request(app).delete(`/api/users/${nickname}/follow`).set('Cookie', cookie);
const accept = (nickname, cookie) =>
  request(app).post(`/api/users/${nickname}/follow/accept`).set('Cookie', cookie);
const reject = (nickname, cookie) =>
  request(app).post(`/api/users/${nickname}/follow/reject`).set('Cookie', cookie);
const notifs = (cookie) =>
  request(app).get('/api/notifications').set('Cookie', cookie);

describe('Solicitudes de seguimiento a cuentas privadas', () => {
  test('seguir a una cuenta privada crea una solicitud pendiente, no un follow', async () => {
    const priv = await registerAndLogin();
    await makePrivate(priv.user.id);
    const a = await registerAndLogin();

    const res = await follow(priv.user.nickname, a.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.estado).toBe('pendiente');
    expect(await followState(a.user.id, priv.user.id)).toBe('pendiente');

    // No cuenta como seguidor todavía.
    const perfil = await request(app)
      .get(`/api/users/${priv.user.nickname}`).set('Cookie', a.cookie);
    expect(perfil.body.data.followers).toHaveLength(0);
    expect(perfil.body.data.mi_estado_seguimiento).toBe('pendiente');
  });

  test('la cuenta privada recibe una notificación de solicitud', async () => {
    const priv = await registerAndLogin();
    await makePrivate(priv.user.id);
    const a = await registerAndLogin();

    await follow(priv.user.nickname, a.cookie);

    const res = await notifs(priv.cookie);
    const notif = res.body.data.find(n => n.tipo === 'solicitud_seguimiento');
    expect(notif).toBeDefined();
    expect(notif.actor_nickname).toBe(a.user.nickname);
  });

  test('seguir a una cuenta pública sigue siendo inmediato (aceptado)', async () => {
    const pub = await registerAndLogin();
    const a = await registerAndLogin();

    const res = await follow(pub.user.nickname, a.cookie);
    expect(res.body.data.estado).toBe('aceptado');
    expect(await followState(a.user.id, pub.user.id)).toBe('aceptado');

    const notif = (await notifs(pub.cookie)).body.data.find(n => n.tipo === 'nuevo_seguidor');
    expect(notif).toBeDefined();
  });

  test('aceptar la solicitud convierte el seguimiento en efectivo y notifica al solicitante', async () => {
    const priv = await registerAndLogin();
    await makePrivate(priv.user.id);
    const a = await registerAndLogin();

    await follow(priv.user.nickname, a.cookie);
    const res = await accept(a.user.nickname, priv.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.aceptada).toBe(true);

    expect(await followState(a.user.id, priv.user.id)).toBe('aceptado');

    // El perfil de la cuenta privada ya tiene 1 seguidor.
    const perfil = await request(app)
      .get(`/api/users/${priv.user.nickname}`).set('Cookie', a.cookie);
    expect(perfil.body.data.followers).toHaveLength(1);
    expect(perfil.body.data.mi_estado_seguimiento).toBe('aceptado');

    // La notificación de solicitud fue consumida en la bandeja del receptor.
    const recv = (await notifs(priv.cookie)).body.data;
    expect(recv.filter(n => n.tipo === 'solicitud_seguimiento')).toHaveLength(0);

    // El solicitante recibe la notificación de aceptación.
    const solic = (await notifs(a.cookie)).body.data.find(n => n.tipo === 'solicitud_aceptada');
    expect(solic).toBeDefined();
    expect(solic.actor_nickname).toBe(priv.user.nickname);
  });

  test('rechazar la solicitud la elimina y permite volver a solicitar', async () => {
    const priv = await registerAndLogin();
    await makePrivate(priv.user.id);
    const a = await registerAndLogin();

    await follow(priv.user.nickname, a.cookie);
    const res = await reject(a.user.nickname, priv.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.rechazada).toBe(true);

    // No queda relación: el botón del solicitante vuelve a "Seguir".
    expect(await followState(a.user.id, priv.user.id)).toBeNull();
    const perfil = await request(app)
      .get(`/api/users/${priv.user.nickname}`).set('Cookie', a.cookie);
    expect(perfil.body.data.mi_estado_seguimiento).toBe('none');

    // La notificación de solicitud fue consumida.
    const recv = (await notifs(priv.cookie)).body.data;
    expect(recv.filter(n => n.tipo === 'solicitud_seguimiento')).toHaveLength(0);

    // Puede volver a solicitar.
    const reFollow = await follow(priv.user.nickname, a.cookie);
    expect(reFollow.body.data.estado).toBe('pendiente');
  });

  test('cancelar (unfollow) y re-solicitar mientras está pendiente NO duplica la notificación', async () => {
    const priv = await registerAndLogin();
    await makePrivate(priv.user.id);
    const a = await registerAndLogin();

    await follow(priv.user.nickname, a.cookie);   // crea solicitud + notif
    await unfollow(priv.user.nickname, a.cookie);  // cancela (la notif persiste)
    await follow(priv.user.nickname, a.cookie);    // re-solicita → dedup

    const recv = (await notifs(priv.cookie)).body.data;
    expect(recv.filter(n => n.tipo === 'solicitud_seguimiento')).toHaveLength(1);
    // La fila volvió a quedar pendiente.
    expect(await followState(a.user.id, priv.user.id)).toBe('pendiente');
  });

  test('tras rechazar, una nueva solicitud SÍ cuenta como notificación nueva', async () => {
    const priv = await registerAndLogin();
    await makePrivate(priv.user.id);
    const a = await registerAndLogin();

    await follow(priv.user.nickname, a.cookie);  // notif #1
    await reject(a.user.nickname, priv.cookie);  // consume la notif
    await follow(priv.user.nickname, a.cookie);  // notif #2 (nueva)

    const recv = (await notifs(priv.cookie)).body.data;
    expect(recv.filter(n => n.tipo === 'solicitud_seguimiento')).toHaveLength(1);
  });

  test('aceptar sin solicitud pendiente no crea relación ni notifica', async () => {
    const priv = await registerAndLogin();
    await makePrivate(priv.user.id);
    const a = await registerAndLogin();

    const res = await accept(a.user.nickname, priv.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.aceptada).toBe(false);
    expect(await followState(a.user.id, priv.user.id)).toBeNull();

    const solic = (await notifs(a.cookie)).body.data.filter(n => n.tipo === 'solicitud_aceptada');
    expect(solic).toHaveLength(0);
  });
});
