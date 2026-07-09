// Defensa 5: máximo 1 recuperación de contraseña exitosa por cuenta cada 24hs.
// La ventana se achica por env ANTES de importar la app para poder probar la
// re-habilitación sin esperar un día. Imports dinámicos a propósito: los
// estáticos se hoistean y el service crearía el limiter con la ventana real
// de 24hs antes de que este env exista.
process.env.FORGOT_PASSWORD_ACCOUNT_WINDOW_MS = '1200';

const request = (await import('supertest')).default;
const app = (await import('../../src/app.js')).default;
const { registerAndLogin } = await import('../helpers.js');
const { _resetForgotAccountLimiter } = await import('../../src/services/user.service.js');

const forgot = (email) =>
  request(app).post('/api/auth/forgot-password').send({ email });

// El limiter es en memoria y los ids de usuario se repiten entre tests
// (truncate con RESTART IDENTITY): se limpia para aislar cada test.
beforeEach(() => _resetForgotAccountLimiter());

// --runInBand: limpiar el env para los archivos que corren después. (El
// limiter ya quedó instanciado con la ventana corta en ESTE archivo, que es
// lo que el test necesita; los demás archivos re-importan el módulo fresco.)
afterAll(() => {
  delete process.env.FORGOT_PASSWORD_ACCOUNT_WINDOW_MS;
});

describe('límite de 1 recuperación de contraseña por cuenta por ventana', () => {
  test('la segunda solicitud dentro de la ventana → 429 con mensaje claro', async () => {
    const u = await registerAndLogin();

    const primera = await forgot(u.raw.email);
    expect(primera.status).toBe(200);

    const segunda = await forgot(u.raw.email);
    expect(segunda.status).toBe(429);
    expect(segunda.body.ok).toBe(false);
    expect(segunda.body.message).toMatch(/ya se envió un enlace/i);
    expect(segunda.body.message).toMatch(/24 horas/i);
  });

  test('pasada la ventana vuelve a permitirse', async () => {
    const u = await registerAndLogin();
    expect((await forgot(u.raw.email)).status).toBe(200);
    expect((await forgot(u.raw.email)).status).toBe(429);

    await new Promise(r => setTimeout(r, 1300));

    expect((await forgot(u.raw.email)).status).toBe(200);
  });

  test('el límite es por cuenta: otra cuenta no se ve afectada', async () => {
    const u1 = await registerAndLogin();
    const u2 = await registerAndLogin();
    expect((await forgot(u1.raw.email)).status).toBe(200);
    expect((await forgot(u2.raw.email)).status).toBe(200);
  });

  test('emails inexistentes siguen respondiendo 200 genérico (anti-enumeración)', async () => {
    expect((await forgot('fantasma_no_existe@gmail.com')).status).toBe(200);
    expect((await forgot('fantasma_no_existe@gmail.com')).status).toBe(200);
  });
});
