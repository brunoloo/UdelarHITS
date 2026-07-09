import { jest } from '@jest/globals';

// Defensa 5: cuota de Resend superada en los tres flujos que envían mail.
// Se mockea el wrapper sendEmail ANTES de importar la app: por defecto envía
// "bien" y cada test lo hace fallar como lo haría Resend con la cuota agotada.
jest.unstable_mockModule('../../src/utils/sendEmail.js', () => ({
  sendEmail: jest.fn(async () => ({ id: 'test' })),
}));

const { sendEmail } = await import('../../src/utils/sendEmail.js');
const request = (await import('supertest')).default;
const app = (await import('../../src/app.js')).default;
const { makeUser, registerAndLogin, getVerificationCode } = await import('../helpers.js');

const quotaError = () => {
  const err = new Error('El servicio de correo está temporalmente saturado');
  err.code = 'EMAIL_QUOTA';
  return err;
};

beforeEach(() => {
  sendEmail.mockReset();
  sendEmail.mockImplementation(async () => ({ id: 'test' }));
});

describe('cuota de Resend — registro (envío del código de verificación)', () => {
  test('si el mail no sale, el registro responde 503 honesto (no "revisá tu correo")', async () => {
    sendEmail.mockImplementation(async () => { throw quotaError(); });
    const res = await request(app).post('/api/auth/register').send(makeUser());
    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
    expect(res.body.message).toMatch(/no pudimos enviar/i);
    expect(res.body.message).toMatch(/problema temporal/i);
  });
});

describe('cuota de Resend — reenvío de código (resend-code)', () => {
  test('con registro pendiente y cuota agotada → 503, nunca el éxito genérico', async () => {
    // Paso 1 con envío OK: deja una verificación pendiente.
    const data = makeUser();
    const reg = await request(app).post('/api/auth/register').send(data);
    expect(reg.status).toBe(200);

    // Ahora Resend "se queda sin cuota".
    sendEmail.mockImplementation(async () => { throw quotaError(); });
    const res = await request(app).post('/api/auth/resend-code').send({ email: data.email });
    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
    expect(res.body.message).toMatch(/no pudimos enviar/i);
  });

  test('sin registro pendiente sigue siendo genérico 200 (sin fuga de existencia)', async () => {
    sendEmail.mockImplementation(async () => { throw quotaError(); });
    const res = await request(app).post('/api/auth/resend-code').send({ email: 'nadie@gmail.com' });
    // No hay pendiente → no se intenta enviar → no hay error que reportar.
    expect(res.status).toBe(200);
  });
});

describe('cuota de Resend — recuperación de contraseña (forgot-password)', () => {
  test('cuenta existente y cuota agotada → 503 honesto, no el 200 genérico', async () => {
    const u = await registerAndLogin();
    sendEmail.mockImplementation(async () => { throw quotaError(); });
    const res = await request(app).post('/api/auth/forgot-password').send({ email: u.raw.email });
    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
    expect(res.body.message).toMatch(/no pudimos enviar/i);
  });

  test('un fallo de envío que NO es cuota tampoco produce falso éxito', async () => {
    const u = await registerAndLogin();
    sendEmail.mockImplementation(async () => {
      const err = new Error('Error al enviar el email');
      err.code = 'EMAIL_SEND_FAILED';
      throw err;
    });
    const res = await request(app).post('/api/auth/forgot-password').send({ email: u.raw.email });
    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
  });

  test('el fallo por cuota NO consume el cupo de 24hs de la cuenta', async () => {
    const u = await registerAndLogin();
    // Primer intento: cae por cuota.
    sendEmail.mockImplementation(async () => { throw quotaError(); });
    expect((await request(app).post('/api/auth/forgot-password').send({ email: u.raw.email })).status).toBe(503);
    // Resend se recupera: el usuario puede pedirlo de nuevo sin esperar 24hs.
    sendEmail.mockImplementation(async () => ({ id: 'test' }));
    expect((await request(app).post('/api/auth/forgot-password').send({ email: u.raw.email })).status).toBe(200);
  });
});
