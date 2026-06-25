import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { makeUser, getVerificationCode, registerVerified } from '../helpers.js';

const register = (body) => request(app).post('/api/auth/register').send(body);
const verify = (body) => request(app).post('/api/auth/verify-email').send(body);
const login = (body) => request(app).post('/api/auth/login').send(body);
const countUsers = async (email) => {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM usuario WHERE email = $1', [email.toLowerCase()]);
  return rows[0].n;
};

describe('Registro con verificación de email', () => {
  test('paso 1 envía código y NO crea la cuenta todavía', async () => {
    const data = makeUser();
    const res = await register(data);
    expect(res.status).toBe(200);
    expect(res.body.requiresVerification).toBe(true);
    // La cuenta no existe hasta confirmar el código.
    expect(await countUsers(data.email)).toBe(0);
    // Pero sí quedó una verificación pendiente con código.
    expect(await getVerificationCode(data.email)).toMatch(/^\d{6}$/);
  });

  test('verificar con el código correcto crea la cuenta y permite login', async () => {
    const data = makeUser();
    await register(data);
    const codigo = await getVerificationCode(data.email);

    const res = await verify({ email: data.email, codigo });
    expect(res.status).toBe(201);
    expect(res.body.data.nickname).toBe(data.nickname.toLowerCase());
    expect(await countUsers(data.email)).toBe(1);
    // Auto-login: verify ya setea la cookie jwt.
    expect(String(res.headers['set-cookie'])).toMatch(/jwt=/);

    const log = await login({ email: data.email, password: data.password });
    expect(log.status).toBe(200);
    expect(String(log.headers['set-cookie'])).toMatch(/jwt=/);
  });

  test('código incorrecto → 400 y la cuenta no se crea', async () => {
    const data = makeUser();
    await register(data);
    const res = await verify({ email: data.email, codigo: '000000' });
    expect(res.status).toBe(400);
    expect(await countUsers(data.email)).toBe(0);
  });

  test('verificar un email sin solicitud pendiente → 400', async () => {
    const res = await verify({ email: 'nadie@gmail.com', codigo: '123456' });
    expect(res.status).toBe(400);
  });

  test('reenviar el registro invalida el código anterior', async () => {
    const data = makeUser();
    await register(data);
    const primerCodigo = await getVerificationCode(data.email);

    // Segundo pedido para el mismo email (otro nickname distinto no importa).
    await register({ ...data });
    const segundoCodigo = await getVerificationCode(data.email);

    // El código vigente es el nuevo; el viejo ya no verifica.
    expect(segundoCodigo).not.toBe(primerCodigo);
    const res = await verify({ email: data.email, codigo: primerCodigo });
    expect(res.status).toBe(400);
  });

  test('tras 5 códigos incorrectos se invalida la verificación', async () => {
    const data = makeUser();
    await register(data);
    for (let i = 0; i < 5; i++) {
      await verify({ email: data.email, codigo: '000001' });
    }
    // Ya invalidada: incluso el código correcto deja de servir.
    const codigo = await getVerificationCode(data.email); // null porque quedó usada
    expect(codigo).toBeNull();
    expect(await countUsers(data.email)).toBe(0);
  });
});

describe('Reenviar código de verificación', () => {
  const resend = (email) => request(app).post('/api/auth/resend-code').send({ email });

  test('reenvía un código nuevo a un registro pendiente e invalida el anterior', async () => {
    const data = makeUser();
    await register(data);
    const primerCodigo = await getVerificationCode(data.email);

    const res = await resend(data.email);
    expect(res.status).toBe(200);

    const nuevoCodigo = await getVerificationCode(data.email);
    expect(nuevoCodigo).toMatch(/^\d{6}$/);
    expect(nuevoCodigo).not.toBe(primerCodigo);

    // El viejo ya no verifica; el nuevo sí.
    expect((await verify({ email: data.email, codigo: primerCodigo })).status).toBe(400);
    expect((await verify({ email: data.email, codigo: nuevoCodigo })).status).toBe(201);
  });

  test('reenviar a un email sin registro pendiente responde 200 genérico (sin fuga)', async () => {
    const res = await resend('inexistente_' + Math.random().toString(36).slice(2, 8) + '@gmail.com');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('reenviar NO crea una cuenta por sí solo', async () => {
    const email = 'pendiente_' + Math.random().toString(36).slice(2, 8) + '@gmail.com';
    await register(makeUser({ email }));
    await resend(email);
    expect(await countUsers(email)).toBe(0);
  });
});

describe('Rate limit de envío de mails', () => {
  test('tras 5 envíos al mismo email, el siguiente → 429', async () => {
    const email = `rl_${Math.random().toString(36).slice(2, 8)}@gmail.com`;
    for (let i = 0; i < 5; i++) {
      const res = await register(makeUser({ email }));
      expect(res.status).toBe(200);
    }
    const sexto = await register(makeUser({ email }));
    expect(sexto.status).toBe(429);
  });
});

describe('Allowlist de dominios de email', () => {
  test('dominio de correo temporal/desechable → 400', async () => {
    for (const email of ['x@mailinator.com', 'x@tempmail.com', 'x@guerrillamail.com', 'x@10minutemail.com']) {
      const res = await register(makeUser({ email }));
      expect(res.status).toBe(400);
    }
  });

  test('dominio conocido (gmail/outlook/proton) → 200', async () => {
    for (const dominio of ['gmail.com', 'outlook.com', 'proton.me']) {
      const res = await register(makeUser({ email: `user_${Math.random().toString(36).slice(2, 8)}@${dominio}` }));
      expect(res.status).toBe(200);
    }
  });

  test('un email con dominio desechable nunca llega a crear cuenta', async () => {
    const email = `x_${Math.random().toString(36).slice(2, 8)}@yopmail.com`;
    await register(makeUser({ email }));
    expect(await countUsers(email)).toBe(0);
    expect(await getVerificationCode(email)).toBeNull();
  });
});
