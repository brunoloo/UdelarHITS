import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { makeUser, registerAndLogin, getVerificationCode, createTopic } from '../helpers.js';

// La facultad es opcional en el registro. Como el alta es en dos pasos (datos →
// código por email) y la cuenta recién se crea al confirmar el código, lo que se
// prueba acá es sobre todo que el valor sobreviva la espera: la fila pendiente,
// el reenvío del código y, finalmente, la creación del usuario.
describe('Registro con facultad (opcional)', () => {
  test('registrarse con facultad la deja guardada en la cuenta creada', async () => {
    const { cookie } = await registerAndLogin({ facultad: 'FING' });

    const me = await request(app).get('/api/users/me').set('Cookie', cookie);

    expect(me.status).toBe(200);
    expect(me.body.data.user.facultad).toBe('FING');
    expect(me.body.data.user.facultad_nombre).toBe('Facultad de Ingeniería');
  });

  test('registrarse sin facultad deja el campo vacío', async () => {
    const { cookie } = await registerAndLogin();

    const me = await request(app).get('/api/users/me').set('Cookie', cookie);

    expect(me.status).toBe(200);
    expect(me.body.data.user.facultad).toBeNull();
    expect(me.body.data.user.facultad_nombre).toBeNull();
  });

  test('la abreviatura se guarda en su forma canónica, no como la mandó el cliente', async () => {
    const { cookie } = await registerAndLogin({ facultad: 'fing' });

    const me = await request(app).get('/api/users/me').set('Cookie', cookie);

    expect(me.body.data.user.facultad).toBe('FING');
  });

  test('una facultad inexistente rechaza el paso 1 y no deja registro pendiente', async () => {
    const data = makeUser({ facultad: 'NOEXISTE' });

    const res = await request(app).post('/api/auth/register').send(data);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/facultad/i);

    // Se valida antes de crear la verificación: no debe quedar nada pendiente
    // (ni haberse consumido el rate limit de envío de códigos).
    const codigo = await getVerificationCode(data.email);
    expect(codigo).toBeNull();
  });

  test('reenviar el código conserva la facultad elegida en el paso 1', async () => {
    const data = makeUser({ facultad: 'FCIEN' });

    const reg = await request(app).post('/api/auth/register').send(data);
    expect(reg.status).toBe(200);

    await request(app).post('/api/auth/resend-code').send({ email: data.email });

    // El reenvío invalida la fila anterior e inserta una nueva: el código válido
    // es el de esa fila, y la facultad tiene que haber viajado con ella.
    const codigo = await getVerificationCode(data.email);
    const ver = await request(app)
      .post('/api/auth/verify-email')
      .send({ email: data.email, codigo });

    expect(ver.status).toBe(201);

    const { rows } = await pool.query(
      'SELECT facultad FROM usuario WHERE email = $1',
      [data.email.toLowerCase()]
    );
    expect(rows[0].facultad).toBe('FCIEN');
  });

  test('la facultad elegida en el registro ya se ve junto al autor de un tema', async () => {
    const { cookie } = await registerAndLogin({ facultad: 'FDER' });
    const topic = await createTopic(cookie);

    const res = await request(app)
      .get(`/api/topics/${topic.id ?? topic.contenido_id}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.autor_facultad).toBe('FDER');
  });
});
