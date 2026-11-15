import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin } from '../helpers.js';

describe('respuestas de error de la API', () => {
  test('una ruta de API inexistente responde 404 en JSON', async () => {
    const res = await request(app).get('/api/no-existe');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body.ok).toBe(false);
  });

  test('un origen fuera de la allowlist responde 403', async () => {
    const res = await request(app).get('/api/').set('Origin', 'https://example.com');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ ok: false, message: 'Solicitud no permitida' });
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('un cuerpo JSON malformado responde 400 sin detalles internos', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ ok: false, message: 'Solicitud inválida' });
  });

  test('chat: el cursor de paginación debe ser numérico', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const conv = await request(app)
      .get(`/api/chat/conversations/${b.user.nickname}`).set('Cookie', a.cookie);
    expect(conv.status).toBe(200);
    const res = await request(app)
      .get(`/api/chat/conversations/${conv.body.data.conversacion_id}/messages?before=abc`)
      .set('Cookie', a.cookie);
    expect(res.status).toBe(400);
  });
});
