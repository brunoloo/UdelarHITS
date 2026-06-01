import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { makeUser, registerAndLogin } from '../helpers.js';

const register = (body) => request(app).post('/api/auth/register').send(body);
const login = (body) => request(app).post('/api/auth/login').send(body);

describe('register — caminos de error', () => {
  test('falta un campo obligatorio → 400', async () => {
    const { nombre, ...sinNombre } = makeUser();
    const res = await register(sinNombre);
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  test('password de menos de 8 caracteres → 400', async () => {
    const res = await register(makeUser({ password: 'corta1' }));
    expect(res.status).toBe(400);
  });

  test('email con formato inválido → 400', async () => {
    const res = await register(makeUser({ email: 'no-es-un-email' }));
    expect(res.status).toBe(400);
  });

  test('nickname duplicado → 409', async () => {
    const base = makeUser();
    await register(base);
    // mismo nickname, distinto email
    const res = await register(makeUser({ nickname: base.nickname }));
    expect(res.status).toBe(409);
  });

  test('email duplicado → 409', async () => {
    const base = makeUser();
    await register(base);
    // mismo email, distinto nickname
    const res = await register(makeUser({ email: base.email }));
    expect(res.status).toBe(409);
  });

  test('registro exitoso devuelve 201 con los datos en data', async () => {
    const res = await register(makeUser());
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty('nickname');
    expect(res.body.data).toHaveProperty('email');
    expect(res.body.data).not.toHaveProperty('password');
    expect(res.body.data).not.toHaveProperty('password_hash');
  });
});

describe('login — caminos de error', () => {
  test('password incorrecto → 401', async () => {
    const { raw } = await registerAndLogin();
    const res = await login({ email: raw.email, password: 'PasswordIncorrecta1' });
    expect(res.status).toBe(401);
  });

  test('usuario inexistente → 401', async () => {
    const res = await login({ email: 'nadie@test.com', password: 'Password123' });
    expect(res.status).toBe(401);
  });

  test('faltan campos → 400', async () => {
    const res = await login({ email: 'algo@test.com' }); // sin password
    expect(res.status).toBe(400);
  });
});

describe('seguridad — password almacenado', () => {
  test('el password se guarda hasheado, nunca en texto plano', async () => {
    const data = makeUser();
    await register(data);
    const { rows } = await pool.query(
      'SELECT password_hash FROM usuario WHERE email = $1',
      [data.email.trim().toLowerCase()]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].password_hash).not.toBe(data.password);     // no es el texto plano
    expect(rows[0].password_hash).toMatch(/^\$2[aby]\$/);       // tiene formato bcrypt
  });

  describe('logout', () => {
    test('logout limpia la cookie jwt', async () => {
        const { cookie } = await registerAndLogin();
        const res = await request(app).post('/api/auth/logout').set('Cookie', cookie);
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);

        // clearCookie emite un set-cookie que vacía jwt y lo expira
        const setCookie = String(res.headers['set-cookie']);
        expect(setCookie).toMatch(/jwt=;/);          // valor vacío
        expect(setCookie).toMatch(/Expires=/i);      // con fecha de expiración (en el pasado)
    });
    });
});