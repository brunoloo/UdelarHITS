import { jest } from '@jest/globals';

// Notificaciones push (Web Push). El módulo de envío se mockea ANTES de importar
// la app (mismo patrón ESM que el mock de Vision en tests/moderation): así se
// puede assertear el enganche en createNotification sin pegarle a FCM/APNs ni
// depender de las claves VAPID. isPushConfigured devuelve false porque en test
// no hay claves y no queremos que ninguna rama intente firmar nada.
jest.unstable_mockModule('../../src/utils/sendWebPush.js', () => ({
  schedulePushForNotification: jest.fn(),
  sendPushToUser: jest.fn(async () => {}),
  isPushConfigured: jest.fn(() => false),
  getVapidPublicKey: jest.fn(() => null),
}));

const { schedulePushForNotification } = await import('../../src/utils/sendWebPush.js');
const request = (await import('supertest')).default;
const app = (await import('../../src/app.js')).default;
const pool = (await import('../../src/config/db.js')).default;
const { registerAndLogin, createTopic, createReply } = await import('../helpers.js');

const SUB = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
  keys: { p256dh: 'clave-publica-del-browser', auth: 'secreto-auth' },
};

const subsOf = async (usuarioId) => {
  const { rows } = await pool.query(
    'SELECT id, usuario_id, endpoint, p256dh FROM push_suscripcion WHERE usuario_id = $1 ORDER BY id',
    [usuarioId]
  );
  return rows;
};
const allSubs = async () => {
  const { rows } = await pool.query('SELECT id, usuario_id, endpoint, p256dh FROM push_suscripcion ORDER BY id');
  return rows;
};

beforeEach(() => {
  schedulePushForNotification.mockClear();
});

describe('GET /api/notifications/push/vapid-key', () => {
  test('sin sesión devuelve 401', async () => {
    const res = await request(app).get('/api/notifications/push/vapid-key');
    expect(res.status).toBe(401);
  });

  test('con sesión devuelve la clave (null en test: no hay VAPID configuradas)', async () => {
    const { cookie } = await registerAndLogin();
    const res = await request(app).get('/api/notifications/push/vapid-key').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('publicKey');
    expect(res.body.data.publicKey).toBeNull();
  });
});

describe('POST /api/notifications/push/subscribe', () => {
  test('una suscripción válida devuelve 201 y guarda una fila', async () => {
    const { user, cookie } = await registerAndLogin();

    const res = await request(app).post('/api/notifications/push/subscribe')
      .set('Cookie', cookie).send(SUB);

    expect(res.status).toBe(201);
    const rows = await subsOf(user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].endpoint).toBe(SUB.endpoint);
  });

  test('postear el mismo endpoint dos veces hace upsert (1 fila, claves actualizadas)', async () => {
    const { user, cookie } = await registerAndLogin();

    await request(app).post('/api/notifications/push/subscribe').set('Cookie', cookie).send(SUB);
    await request(app).post('/api/notifications/push/subscribe').set('Cookie', cookie)
      .send({ ...SUB, keys: { ...SUB.keys, p256dh: 'clave-rotada' } });

    const rows = await subsOf(user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].p256dh).toBe('clave-rotada');
  });

  test('un endpoint ya usado por otro usuario se reasigna al que lo postea', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();

    await request(app).post('/api/notifications/push/subscribe').set('Cookie', a.cookie).send(SUB);
    await request(app).post('/api/notifications/push/subscribe').set('Cookie', b.cookie).send(SUB);

    const rows = await allSubs();
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].usuario_id)).toBe(Number(b.user.id));
    expect(await subsOf(a.user.id)).toHaveLength(0);
  });

  test('payload inválido devuelve 400', async () => {
    const { user, cookie } = await registerAndLogin();

    const sinAuth = await request(app).post('/api/notifications/push/subscribe')
      .set('Cookie', cookie).send({ endpoint: SUB.endpoint, keys: { p256dh: 'x' } });
    expect(sinAuth.status).toBe(400);

    const sinEndpoint = await request(app).post('/api/notifications/push/subscribe')
      .set('Cookie', cookie).send({ endpoint: '', keys: SUB.keys });
    expect(sinEndpoint.status).toBe(400);

    const noHttps = await request(app).post('/api/notifications/push/subscribe')
      .set('Cookie', cookie).send({ endpoint: 'http://inseguro.test/x', keys: SUB.keys });
    expect(noHttps.status).toBe(400);

    expect(await subsOf(user.id)).toHaveLength(0);
  });
});

describe('POST /api/notifications/push/unsubscribe', () => {
  test('con endpoint borra solo ese dispositivo', async () => {
    const { user, cookie } = await registerAndLogin();
    const otro = { ...SUB, endpoint: 'https://fcm.googleapis.com/fcm/send/otro-device' };

    await request(app).post('/api/notifications/push/subscribe').set('Cookie', cookie).send(SUB);
    await request(app).post('/api/notifications/push/subscribe').set('Cookie', cookie).send(otro);

    const res = await request(app).post('/api/notifications/push/unsubscribe')
      .set('Cookie', cookie).send({ endpoint: SUB.endpoint });

    expect(res.status).toBe(200);
    const rows = await subsOf(user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].endpoint).toBe(otro.endpoint);
  });

  test('sin endpoint borra todas las suscripciones del usuario', async () => {
    const { user, cookie } = await registerAndLogin();
    await request(app).post('/api/notifications/push/subscribe').set('Cookie', cookie).send(SUB);
    await request(app).post('/api/notifications/push/subscribe').set('Cookie', cookie)
      .send({ ...SUB, endpoint: 'https://fcm.googleapis.com/fcm/send/otro-device' });

    const res = await request(app).post('/api/notifications/push/unsubscribe')
      .set('Cookie', cookie).send({});

    expect(res.status).toBe(200);
    expect(await subsOf(user.id)).toHaveLength(0);
  });
});

describe('PATCH /api/notifications/push/enabled', () => {
  test('activado:false apaga la columna y borra las suscripciones', async () => {
    const { user, cookie } = await registerAndLogin();
    await request(app).post('/api/notifications/push/subscribe').set('Cookie', cookie).send(SUB);

    const res = await request(app).patch('/api/notifications/push/enabled')
      .set('Cookie', cookie).send({ activado: false });

    expect(res.status).toBe(200);
    expect(res.body.data.push_activado).toBe(false);

    const { rows } = await pool.query('SELECT push_activado FROM usuario WHERE id = $1', [user.id]);
    expect(rows[0].push_activado).toBe(false);
    expect(await subsOf(user.id)).toHaveLength(0);
  });

  test('un valor no booleano devuelve 400', async () => {
    const { cookie } = await registerAndLogin();
    const res = await request(app).patch('/api/notifications/push/enabled')
      .set('Cookie', cookie).send({ activado: 'no' });
    expect(res.status).toBe(400);
  });
});

describe('push_activado y cascada', () => {
  test('GET /api/users/me incluye push_activado (true por default)', async () => {
    const { cookie } = await registerAndLogin();
    const res = await request(app).get('/api/users/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.user.push_activado).toBe(true);
  });

  test('borrar el usuario elimina sus suscripciones (ON DELETE CASCADE)', async () => {
    const { user, cookie } = await registerAndLogin();
    await request(app).post('/api/notifications/push/subscribe').set('Cookie', cookie).send(SUB);
    expect(await subsOf(user.id)).toHaveLength(1);

    await pool.query('DELETE FROM usuario WHERE id = $1', [user.id]);
    expect(await allSubs()).toHaveLength(0);
  });
});

describe('Enganche en createNotification', () => {
  test('crear una notificación real agenda el push con el id de esa notificación', async () => {
    const autor = await registerAndLogin();
    const otro = await registerAndLogin();
    const topic = await createTopic(autor.cookie);

    schedulePushForNotification.mockClear();
    await createReply(otro.cookie, { tema_id: topic.id ?? topic.contenido_id });

    const notifs = await request(app).get('/api/notifications')
      .set('Cookie', autor.cookie).then(r => r.body.data);
    const notif = notifs.find(n => n.tipo === 'comentario_en_tema');
    expect(notif).toBeDefined();

    expect(schedulePushForNotification).toHaveBeenCalledTimes(1);
    expect(schedulePushForNotification).toHaveBeenCalledWith(notif.id);
  });

  test('el push no interfiere con la notificación in-app: sigue listándose', async () => {
    const autor = await registerAndLogin();
    const otro = await registerAndLogin();
    const topic = await createTopic(autor.cookie);

    await createReply(otro.cookie, { tema_id: topic.id ?? topic.contenido_id });

    const res = await request(app).get('/api/notifications').set('Cookie', autor.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.some(n => n.tipo === 'comentario_en_tema')).toBe(true);
  });
});
