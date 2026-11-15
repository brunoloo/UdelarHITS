import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createTopic, createReply } from '../helpers.js';

const idOf = (x) => x.id ?? x.contenido_id;

const reportar = (contenido_id, motivo, cookie) =>
  request(app).post('/api/reports/create').set('Cookie', cookie).send({ contenido_id, motivo });

describe('reportes — validaciones', () => {
  test('reporte válido sobre tema ajeno → 201', async () => {
    const autor = await registerAndLogin();
    const reportante = await registerAndLogin();
    const topic = await createTopic(autor.cookie);

    const res = await reportar(idOf(topic), 'spam', reportante.cookie);
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.total_reportes).toBe(1);
    expect(res.body.data.inactivado).toBe(false);
  });

  test('no se puede reportar el propio contenido → 403', async () => {
    const autor = await registerAndLogin();
    const topic = await createTopic(autor.cookie);

    const res = await reportar(idOf(topic), 'spam', autor.cookie);
    expect(res.status).toBe(403);
  });

  test('no se puede reportar dos veces el mismo contenido → 409', async () => {
    const autor = await registerAndLogin();
    const reportante = await registerAndLogin();
    const topic = await createTopic(autor.cookie);

    const r1 = await reportar(idOf(topic), 'spam', reportante.cookie);
    expect(r1.status).toBe(201);

    const r2 = await reportar(idOf(topic), 'spam', reportante.cookie);
    expect(r2.status).toBe(409);
  });

  test('motivo inválido → 400', async () => {
    const autor = await registerAndLogin();
    const reportante = await registerAndLogin();
    const topic = await createTopic(autor.cookie);

    const res = await reportar(idOf(topic), 'motivo_que_no_existe', reportante.cookie);
    expect(res.status).toBe(400);
  });

  test('contenido inexistente → 404', async () => {
    const reportante = await registerAndLogin();
    const res = await reportar(999999999, 'spam', reportante.cookie);
    expect(res.status).toBe(404);
  });

  test('sin sesión → no autorizado', async () => {
    const autor = await registerAndLogin();
    const topic = await createTopic(autor.cookie);
    const res = await request(app).post('/api/reports/create')
      .send({ contenido_id: idOf(topic), motivo: 'spam' });
    expect(res.status).toBeGreaterThanOrEqual(401);
  });
});