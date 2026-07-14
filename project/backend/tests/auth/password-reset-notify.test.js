// BUG 2: "olvidé mi contraseña" puede setear una contraseña por PRIMERA VEZ en
// una cuenta que era Google-only (auth_provider='google', password_hash NULL).
// Eso agrega un segundo método de acceso; el dueño del email debe enterarse.
// Se mockea sendEmail (como en resend-quota.test.js) para contar envíos y
// extraer el token de recuperación del HTML (el token crudo solo viaja al mail).
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../src/utils/sendEmail.js', () => ({
  sendEmail: jest.fn(async () => ({ id: 'test' })),
}));

const { sendEmail } = await import('../../src/utils/sendEmail.js');
const request = (await import('supertest')).default;
const app = (await import('../../src/app.js')).default;
const pool = (await import('../../src/config/db.js')).default;
const { registerAndLogin } = await import('../helpers.js');
const { _resetForgotAccountLimiter } = await import('../../src/services/user.service.js');

const rand = () => Math.random().toString(36).slice(2, 8);

// Cuenta Google-only (sin contraseña) directo en la BD: el register normal
// siempre crea cuentas locales con contraseña.
async function createGoogleOnlyUser() {
  const r = rand();
  const email = `g_${r}@gmail.com`;
  const { rows } = await pool.query(
    `INSERT INTO usuario (nickname, nombre, email, password_hash, rol, estado, auth_provider, nickname_confirmado)
     VALUES ($1, $2, $3, NULL, 'user', 'activo', 'google', TRUE)
     RETURNING id, email`,
    [`g_${r}`, 'google user', email]
  );
  return rows[0];
}

// El token real solo viaja en el email (en la BD se guarda hasheado): lo
// recuperamos del HTML del mail de recuperación capturado por el mock.
function extractResetToken() {
  const call = sendEmail.mock.calls.find(([a]) => /reset-password\.html\?token=/.test(a?.html || ''));
  const m = call && call[0].html.match(/token=([a-f0-9]+)/i);
  return m ? m[1] : null;
}

beforeEach(() => {
  _resetForgotAccountLimiter();
  sendEmail.mockClear();
  sendEmail.mockImplementation(async () => ({ id: 'test' }));
});

describe('reset de contraseña — aviso al setear contraseña por primera vez', () => {
  test('(a) primera contraseña en cuenta Google-only dispara el aviso de seguridad', async () => {
    const g = await createGoogleOnlyUser();

    const forgot = await request(app).post('/api/auth/forgot-password').send({ email: g.email });
    expect(forgot.status).toBe(200);

    const token = extractResetToken();
    expect(token).toBeTruthy();

    // Contar solo lo que dispare el reset en sí.
    sendEmail.mockClear();
    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'NuevaSegura99' });
    expect(reset.status).toBe(200);

    // Se envió exactamente un aviso, a la misma dirección, con el mensaje pedido.
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const [arg] = sendEmail.mock.calls[0];
    expect(arg.to).toBe(g.email);
    expect(arg.subject).toMatch(/se agregó una contraseña/i);
    expect(arg.html).toMatch(/si no fuiste vos/i);

    // Y la contraseña quedó efectivamente seteada (la cuenta ahora puede loguear).
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: g.email, password: 'NuevaSegura99' });
    expect(login.status).toBe(200);
  });

  test('(b) reset normal en cuenta que ya tenía contraseña NO dispara el aviso extra', async () => {
    const u = await registerAndLogin();

    const forgot = await request(app).post('/api/auth/forgot-password').send({ email: u.raw.email });
    expect(forgot.status).toBe(200);

    const token = extractResetToken();
    expect(token).toBeTruthy();

    sendEmail.mockClear();
    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, newPassword: 'OtraSegura88' });
    expect(reset.status).toBe(200);

    // Ya tenía contraseña: es un reset común, sin ningún email extra.
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
