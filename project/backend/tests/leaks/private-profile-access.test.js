import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createAdmin, createCategory, createTopic, createReply } from '../helpers.js';

const setPrivado = (userId) => pool.query(`UPDATE usuario SET privado = TRUE WHERE id = $1`, [userId]);
const topicId = (t) => t.id ?? t.contenido_id;

// El objetivo de estos tests es el control de acceso del BACKEND: se le pega
// directo al endpoint (sin pasar por el canView() del frontend, que es solo
// cosmético) y se verifica que:
//   1. "email" (y otros campos sensibles) NUNCA viajan por GET /users/:nickname.
//   2. El contenido/actividad de una cuenta privada no viaja a viewers no
//      autorizados, ni por el perfil ni por los endpoints de topics/replies.
describe('Control de acceso — GET /users/:nickname (P0: fuga de email + perfil privado)', () => {
  // Helper: afirma que el email del objetivo NO aparece en ninguna parte del body.
  const assertNoEmailLeak = (body, email) => {
    expect(JSON.stringify(body)).not.toContain(email);
    if (body?.data?.user) {
      expect(body.data.user.email).toBeUndefined();
      expect(body.data.user.rol).toBeUndefined();
      expect(body.data.user.nickname_confirmado).toBeUndefined();
    }
  };

  test('(a) viewer anónimo: el endpoint exige auth (401) y no filtra email', async () => {
    const target = await registerAndLogin();
    const res = await request(app).get(`/api/users/${target.user.nickname}`);
    expect(res.status).toBe(401);
    assertNoEmailLeak(res.body, target.raw.email);
  });

  test('(b) viewer no-seguidor viendo cuenta privada: sin email y sin contenido', async () => {
    const target = await registerAndLogin();
    await createCategory(target.cookie); // genera actividad que NO debe viajar
    await setPrivado(target.user.id);

    const viewer = await registerAndLogin();
    const res = await request(app).get(`/api/users/${target.user.nickname}`).set('Cookie', viewer.cookie);

    expect(res.status).toBe(200);
    assertNoEmailLeak(res.body, target.raw.email);
    expect(res.body.data.user.privado).toBe(true);
    expect(res.body.data.puede_ver).toBe(false);
    // Nada de actividad/contenido de la cuenta privada.
    expect(res.body.data.categories).toEqual([]);
    expect(res.body.data.followers).toEqual([]);
    expect(res.body.data.following).toEqual([]);
    // La card pública SÍ viaja (contrato mínimo acordado): nickname, nombre y
    // url_imagen deben estar presentes para poder pintar el cartel "cuenta
    // privada" sin romper la UI (sobre-corregir vaciando el objeto sería un bug).
    const u = res.body.data.user;
    expect(u.nickname).toBe(target.user.nickname);
    expect(typeof u.nombre).toBe('string');
    expect(u.nombre.length).toBeGreaterThan(0);
    expect(u).toHaveProperty('url_imagen'); // presente aunque sea null (sin avatar)
    expect(u).toHaveProperty('fecha_creacion');
  });

  test('(c) viewer viendo cuenta pública: sin email pero con contenido', async () => {
    const target = await registerAndLogin();
    await createCategory(target.cookie);

    const viewer = await registerAndLogin();
    const res = await request(app).get(`/api/users/${target.user.nickname}`).set('Cookie', viewer.cookie);

    expect(res.status).toBe(200);
    assertNoEmailLeak(res.body, target.raw.email);
    expect(res.body.data.user.privado).toBe(false);
    expect(res.body.data.puede_ver).toBe(true);
    expect(res.body.data.categories.length).toBeGreaterThan(0);
  });

  test('(d) el dueño por /users/me SÍ recibe su email (no debe romperse)', async () => {
    const me = await registerAndLogin();
    const res = await request(app).get('/api/users/me').set('Cookie', me.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.user.email).toBe(me.raw.email.toLowerCase());
  });

  test('(e) seguidor aceptado viendo cuenta privada: ve el contenido, sin email', async () => {
    const target = await registerAndLogin();
    await createCategory(target.cookie);
    const follower = await registerAndLogin();
    // Sigue mientras es pública → queda 'aceptado'; luego se vuelve privada.
    await request(app).post(`/api/users/${target.user.nickname}/follow`).set('Cookie', follower.cookie);
    await setPrivado(target.user.id);

    const res = await request(app).get(`/api/users/${target.user.nickname}`).set('Cookie', follower.cookie);
    expect(res.status).toBe(200);
    assertNoEmailLeak(res.body, target.raw.email);
    expect(res.body.data.puede_ver).toBe(true);
    expect(res.body.data.categories.length).toBeGreaterThan(0);
  });

  test('(f) solicitud pendiente (no aceptada) NO alcanza para ver contenido privado', async () => {
    const target = await registerAndLogin();
    await createCategory(target.cookie);
    await setPrivado(target.user.id);
    const viewer = await registerAndLogin();
    // Cuenta ya privada → el follow queda 'pendiente'.
    await request(app).post(`/api/users/${target.user.nickname}/follow`).set('Cookie', viewer.cookie);

    const res = await request(app).get(`/api/users/${target.user.nickname}`).set('Cookie', viewer.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.puede_ver).toBe(false);
    expect(res.body.data.mi_estado_seguimiento).toBe('pendiente');
    expect(res.body.data.categories).toEqual([]);
  });

  test('(g) admin viendo cuenta privada: ve actividad (moderación) pero NUNCA email', async () => {
    const target = await registerAndLogin();
    await createCategory(target.cookie);
    await setPrivado(target.user.id);
    const admin = await createAdmin();

    const res = await request(app).get(`/api/users/${target.user.nickname}`).set('Cookie', admin.cookie);
    expect(res.status).toBe(200);
    assertNoEmailLeak(res.body, target.raw.email);
    expect(res.body.data.puede_ver).toBe(true);
    expect(res.body.data.categories.length).toBeGreaterThan(0);
  });

  test('(h) cuenta privada + viewer bloqueado por el dueño: sin email ni contenido', async () => {
    const target = await registerAndLogin();
    await createCategory(target.cookie);
    await setPrivado(target.user.id);
    const viewer = await registerAndLogin();
    // El dueño bloquea al viewer.
    await request(app).post(`/api/users/${viewer.user.nickname}/block`).set('Cookie', target.cookie);

    const res = await request(app).get(`/api/users/${target.user.nickname}`).set('Cookie', viewer.cookie);
    expect(res.status).toBe(200);
    assertNoEmailLeak(res.body, target.raw.email);
    expect(res.body.data.te_bloqueo).toBe(true);
    expect(res.body.data.puede_ver).toBe(false);
    expect(res.body.data.categories).toEqual([]);
    expect(res.body.data.followers).toEqual([]);
    expect(res.body.data.following).toEqual([]);
  });
});

describe('Control de acceso — contenido de cuenta privada por endpoints directos', () => {
  test('GET /topics/user/:id → 403 para no-seguidor de cuenta privada', async () => {
    const target = await registerAndLogin();
    await createTopic(target.cookie);
    await setPrivado(target.user.id);
    const viewer = await registerAndLogin();

    const res = await request(app).get(`/api/topics/user/${target.user.id}`).set('Cookie', viewer.cookie);
    expect(res.status).toBe(403);
  });

  test('GET /replies/user/:id → 403 para no-seguidor de cuenta privada', async () => {
    const target = await registerAndLogin();
    const topic = await createTopic(target.cookie);
    await createReply(target.cookie, { tema_id: topicId(topic), cuerpo: 'comentario privado' });
    await setPrivado(target.user.id);
    const viewer = await registerAndLogin();

    const res = await request(app).get(`/api/replies/user/${target.user.id}`).set('Cookie', viewer.cookie);
    expect(res.status).toBe(403);
  });

  test('GET /topics/user/:id → 200 para cuenta pública', async () => {
    const target = await registerAndLogin();
    await createTopic(target.cookie);
    const viewer = await registerAndLogin();

    const res = await request(app).get(`/api/topics/user/${target.user.id}`).set('Cookie', viewer.cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('GET /topics/user/:id y /replies/user/:id → el dueño ve su propio contenido privado', async () => {
    const target = await registerAndLogin();
    const topic = await createTopic(target.cookie);
    await createReply(target.cookie, { tema_id: topicId(topic), cuerpo: 'mi comentario' });
    await setPrivado(target.user.id);

    const t = await request(app).get(`/api/topics/user/${target.user.id}`).set('Cookie', target.cookie);
    const r = await request(app).get(`/api/replies/user/${target.user.id}`).set('Cookie', target.cookie);
    expect(t.status).toBe(200);
    expect(r.status).toBe(200);
  });
});
