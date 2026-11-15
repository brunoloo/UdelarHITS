import { jest } from '@jest/globals';

// Se mockea la librería web-push y no el módulo propio, para que la lógica de envío corra de verdad.
const sendNotification = jest.fn();
const setVapidDetails = jest.fn();
jest.unstable_mockModule('web-push', () => ({
  default: { sendNotification, setVapidDetails },
}));

const { sendPushToUser } = await import('../../src/utils/sendWebPush.js');
const pool = (await import('../../src/config/db.js')).default;
const { registerAndLogin } = await import('../helpers.js');

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/rollback-test';
const ID_INEXISTENTE = 999999999;

// Usuario con un dispositivo suscripto y una notificación ya persistida.
async function conNotificacion() {
  const { user } = await registerAndLogin();
  await pool.query(
    'INSERT INTO push_suscripcion (usuario_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4)',
    [user.id, ENDPOINT, 'clave-publica', 'secreto-auth']
  );
  const { rows } = await pool.query(
    `INSERT INTO notificacion (usuario_id, tipo, mensaje, url)
     VALUES ($1, 'reaccion_like', 'alguien le dio me gusta a tu comentario', '/comment/1')
     RETURNING id`,
    [user.id]
  );
  return { user, notifId: rows[0].id };
}

const subsDe = async (usuarioId) => {
  const { rows } = await pool.query(
    'SELECT id FROM push_suscripcion WHERE usuario_id = $1',
    [usuarioId]
  );
  return rows;
};

beforeEach(() => {
  sendNotification.mockReset();
  sendNotification.mockResolvedValue({ statusCode: 201 });
  setVapidDetails.mockClear();
});

describe('sendPushToUser: detección de ROLLBACK', () => {
  test('no envía nada si la notificación no existe (transacción revertida)', async () => {
    await sendPushToUser(ID_INEXISTENTE, 2);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  // Sin fake timers: cuelgan el TRUNCATE del beforeEach.
  test('el reintento entrega el push si la transacción commitea tarde', async () => {
    const { user } = await registerAndLogin();
    await pool.query(
      'INSERT INTO push_suscripcion (usuario_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4)',
      [user.id, ENDPOINT, 'clave-publica', 'secreto-auth']
    );

    // Id todavía inexistente: lo que ve el primer intento con la transacción abierta.
    const notifId = 424242;
    await sendPushToUser(notifId, 1);
    expect(sendNotification).not.toHaveBeenCalled();

    // "Commit" tardío, entre el primer intento y el reintento.
    await pool.query(
      `INSERT INTO notificacion (id, usuario_id, tipo, mensaje, url)
       VALUES ($1, $2, 'reaccion_like', 'me gusta tardío', '/comment/1')`,
      [notifId, user.id]
    );

    await new Promise(resolve => setTimeout(resolve, 5500));
    expect(sendNotification).toHaveBeenCalledTimes(1);
  }, 20000);

  test('una notificación que sí existe sale hacia el push service', async () => {
    const { notifId } = await conNotificacion();
    await sendPushToUser(notifId, 1);

    expect(sendNotification).toHaveBeenCalledTimes(1);
    const [suscripcion, payload] = sendNotification.mock.calls[0];
    expect(suscripcion.endpoint).toBe(ENDPOINT);
    // El payload tiene que entrar en el límite de Safari (~2 KB).
    expect(Buffer.byteLength(payload)).toBeLessThan(2048);
    const cuerpo = JSON.parse(payload);
    expect(cuerpo).toMatchObject({
      notifId,
      url: '/comment/1',
      tag: 'notif-reaccion_like',
      title: 'UdelarHITS',
      body: 'alguien le dio me gusta a tu comentario',
    });
  });

  test('respeta el apagado global del destinatario', async () => {
    const { user, notifId } = await conNotificacion();
    await pool.query('UPDATE usuario SET push_activado = FALSE WHERE id = $1', [user.id]);

    await sendPushToUser(notifId, 1);
    expect(sendNotification).not.toHaveBeenCalled();
  });
});

describe('sendPushToUser: limpieza de suscripciones muertas', () => {
  test('un 410 borra la suscripción', async () => {
    const { user, notifId } = await conNotificacion();
    sendNotification.mockRejectedValue(Object.assign(new Error('Gone'), { statusCode: 410 }));

    await sendPushToUser(notifId, 1);
    expect(await subsDe(user.id)).toHaveLength(0);
  });

  test('un 500 NO la borra: es transitorio', async () => {
    const { user, notifId } = await conNotificacion();
    sendNotification.mockRejectedValue(Object.assign(new Error('Server Error'), { statusCode: 500 }));

    await sendPushToUser(notifId, 1);
    // Una caída momentánea del servicio no debe dar de baja la suscripción.
    expect(await subsDe(user.id)).toHaveLength(1);
  });
});
