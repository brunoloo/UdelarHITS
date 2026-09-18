import { jest } from '@jest/globals';

// El camino del ROLLBACK es la parte más delicada del feature: sendPushToUser
// re-consulta la fila con el pool (nunca con el client transaccional) para no
// anunciar una sanción o un like que la transacción terminó revirtiendo.
//
// A diferencia de push.test.js, que mockea el módulo propio para assertear el
// enganche, acá se mockea la LIBRERÍA web-push: así la lógica de sendWebPush.js
// corre de verdad y se puede verificar qué sale (y qué no) hacia FCM/APNs.
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

  // Fake timers no sirven acá: cuelgan el TRUNCATE del beforeEach de setup.js.
  // Este test ejercita el reintento de verdad, que es además el caso que motiva
  // su existencia: la transacción que commitea después del primer intento.
  test('el reintento entrega el push si la transacción commitea tarde', async () => {
    const { user } = await registerAndLogin();
    await pool.query(
      'INSERT INTO push_suscripcion (usuario_id, endpoint, p256dh, auth) VALUES ($1, $2, $3, $4)',
      [user.id, ENDPOINT, 'clave-publica', 'secreto-auth']
    );

    // Id todavía inexistente: es lo que ve el primer intento mientras la
    // transacción sigue abierta.
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
      // El mensaje es el título: 'UdelarHITS' ya lo pone el sistema operativo.
      title: 'alguien le dio me gusta a tu comentario',
    });
    expect(cuerpo.body).toBeUndefined();
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
    // Desuscribir por una caída momentánea de FCM dejaría al usuario sin push
    // para siempre, sin que él haya hecho nada.
    expect(await subsDe(user.id)).toHaveLength(1);
  });
});
