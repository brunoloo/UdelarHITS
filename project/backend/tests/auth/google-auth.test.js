import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { handleGoogleAuthService, confirmNicknameService } from '../../src/services/user.service.js';


const fakeProfile = (email = 'googleuser@gmail.com', displayName = 'María López') => ({
  emails: [{ value: email }],
  displayName,
});

test('nuevo usuario de Google se crea correctamente', async () => {
  const user = await handleGoogleAuthService(fakeProfile('new_google@gmail.com', 'Test Google'));
  expect(user).toHaveProperty('id');
  expect(user.auth_provider).toBe('google');
  expect(user.email).toBe('new_google@gmail.com');
  expect(user.estado).toBe('activo');
});

test('usuario de Google existente retorna la misma cuenta', async () => {
  const first = await handleGoogleAuthService(fakeProfile('repeat@gmail.com'));
  const second = await handleGoogleAuthService(fakeProfile('repeat@gmail.com'));
  expect(String(first.id)).toBe(String(second.id));
});

test('email local existente lanza EMAIL_TAKEN_LOCAL', async () => {
  await pool.query(
    `INSERT INTO usuario (nickname, nombre, email, password_hash, rol, estado, auth_provider)
     VALUES ('localuser', 'Local', 'local@gmail.com', '$2b$10$dummy_hash_for_test_xxxxx', 'user', 'activo', 'local')`
  );
  await expect(handleGoogleAuthService(fakeProfile('local@gmail.com')))
    .rejects.toMatchObject({ code: 'EMAIL_TAKEN_LOCAL' });
});

test('nickname usa solo el primer nombre y siempre tiene sufijo numérico', async () => {
  const user = await handleGoogleAuthService(fakeProfile('firstname@gmail.com', 'Bruno López'));
  expect(user.nickname).toMatch(/^bruno\d{4,}$/);
});

test('nickname generado no contiene caracteres inválidos', async () => {
  const user = await handleGoogleAuthService(fakeProfile('accents@gmail.com', 'José Ñoño'));
  expect(user.nickname).toMatch(/^[a-z0-9]+$/);
});

test('colisión de nickname genera uno diferente', async () => {
  const u1 = await handleGoogleAuthService(fakeProfile('dup1@gmail.com', 'samename'));
  const u2 = await handleGoogleAuthService(fakeProfile('dup2@gmail.com', 'samename'));
  expect(u1.nickname).not.toBe(u2.nickname);
});

test('nuevo usuario de Google tiene nickname_confirmado = false', async () => {
  const user = await handleGoogleAuthService(fakeProfile('unconfirmed@gmail.com', 'Unconfirmed'));
  expect(user.nickname_confirmado).toBe(false);
});

test('confirmNicknameService actualiza nickname y marca confirmado', async () => {
  const user = await handleGoogleAuthService(fakeProfile('confirm@gmail.com', 'ToConfirm'));
  expect(user.nickname_confirmado).toBe(false);

  const updated = await confirmNicknameService(user.id, 'mi_nick_elegido');
  expect(updated.nickname).toBe('mi_nick_elegido');
  expect(updated.nickname_confirmado).toBe(true);
});

test('confirmNicknameService rechaza nickname duplicado', async () => {
  await pool.query(
    `INSERT INTO usuario (nickname, nombre, email, password_hash, rol, estado, auth_provider)
     VALUES ('ocupado', 'Ocupado', 'ocupado@gmail.com', '$2b$10$dummy_hash_for_test_xxxxx', 'user', 'activo', 'local')`
  );
  const user = await handleGoogleAuthService(fakeProfile('trydup@gmail.com', 'TryDup'));
  await expect(confirmNicknameService(user.id, 'ocupado'))
    .rejects.toMatchObject({ code: 'NICKNAME_TAKEN' });
});

test('GET /api/auth/google redirige a accounts.google.com', async () => {
  const res = await request(app).get('/api/auth/google');
  expect(res.status).toBe(302);
  expect(res.headers.location).toMatch(/accounts\.google\.com/);
});

test('login normal con cuenta Google-only devuelve error claro', async () => {
  await handleGoogleAuthService(fakeProfile('googleonly@gmail.com', 'Google Only'));
  const res = await request(app).post('/api/auth/login').send({
    email: 'googleonly@gmail.com',
    nickname: 'googleonly@gmail.com',
    password: 'cualquiera123',
  });
  expect(res.status).toBe(401);
  expect(res.body.message).toMatch(/Google/);
});
