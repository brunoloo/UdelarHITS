import http from 'http';
import express from 'express';
import { initSocket, getIO } from '../../src/socket.js';
import request from 'supertest';
import app from '../../src/app.js';
import edgeMiddleware, { permitidoPorBorde } from '../../src/middlewares/edge.middleware.js';

const SECRETO = 'secreto-de-prueba-123';

const appIp = express();
appIp.set('trust proxy', 1);
appIp.use(edgeMiddleware);
appIp.get('/ip', (req, res) => res.json({ ip: req.ip }));
appIp.get('/health', (req, res) => res.json({ ok: true }));

function configurar({ secreto, enforce } = {}) {
  if (secreto === undefined) delete process.env.EDGE_SECRET;
  else process.env.EDGE_SECRET = secreto;
  if (enforce === undefined) delete process.env.EDGE_ENFORCE;
  else process.env.EDGE_ENFORCE = enforce;
}

afterEach(() => configurar());

describe('sin EDGE_SECRET', () => {
  test('deja pasar todo y no cree en el header de IP', async () => {
    const res = await request(appIp).get('/ip').set('cf-connecting-ip', '203.0.113.7');
    expect(res.status).toBe(200);
    expect(res.body.ip).not.toBe('203.0.113.7');
  });

  test('EDGE_ENFORCE solo no bloquea nada', async () => {
    configurar({ enforce: 'true' });
    const res = await request(appIp).get('/ip');
    expect(res.status).toBe(200);
  });
});

describe('con EDGE_SECRET, sin enforce (transición)', () => {
  beforeEach(() => configurar({ secreto: SECRETO }));

  test('con el secreto, usa la IP que manda el borde', async () => {
    const res = await request(appIp).get('/ip')
      .set('x-edge-auth', SECRETO)
      .set('cf-connecting-ip', '203.0.113.7');
    expect(res.body.ip).toBe('203.0.113.7');
  });

  test('también acepta IPv6', async () => {
    const res = await request(appIp).get('/ip')
      .set('x-edge-auth', SECRETO)
      .set('cf-connecting-ip', '2001:db8::1');
    expect(res.body.ip).toBe('2001:db8::1');
  });

  test('sin el secreto, deja pasar pero ignora la IP falsificada', async () => {
    const res = await request(appIp).get('/ip').set('cf-connecting-ip', '203.0.113.7');
    expect(res.status).toBe(200);
    expect(res.body.ip).not.toBe('203.0.113.7');
  });

  test('con secreto incorrecto, ignora la IP', async () => {
    const res = await request(appIp).get('/ip')
      .set('x-edge-auth', 'otro')
      .set('cf-connecting-ip', '203.0.113.7');
    expect(res.status).toBe(200);
    expect(res.body.ip).not.toBe('203.0.113.7');
  });

  test('ignora un header de IP que no es una IP', async () => {
    const res = await request(appIp).get('/ip')
      .set('x-edge-auth', SECRETO)
      .set('cf-connecting-ip', 'no-es-ip');
    expect(res.status).toBe(200);
    expect(res.body.ip).not.toBe('no-es-ip');
  });
});

describe('con EDGE_SECRET y EDGE_ENFORCE=true', () => {
  beforeEach(() => configurar({ secreto: SECRETO, enforce: 'true' }));

  test('rechaza lo que llega sin el header', async () => {
    const res = await request(appIp).get('/ip');
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ ok: false, message: 'Solicitud no permitida' });
  });

  test('rechaza un secreto incorrecto, incluso de igual largo', async () => {
    const res = await request(appIp).get('/ip').set('x-edge-auth', 'x'.repeat(SECRETO.length));
    expect(res.status).toBe(403);
  });

  test('deja pasar con el secreto correcto', async () => {
    const res = await request(appIp).get('/ip').set('x-edge-auth', SECRETO);
    expect(res.status).toBe(200);
  });

  test('tolera espacios o saltos de línea al cargar la variable', async () => {
    configurar({ secreto: `  ${SECRETO}\n`, enforce: 'true' });
    const res = await request(appIp).get('/ip').set('x-edge-auth', SECRETO);
    expect(res.status).toBe(200);
  });

  test('un secreto de solo espacios equivale a no tenerlo', async () => {
    configurar({ secreto: '   ', enforce: 'true' });
    expect((await request(appIp).get('/ip')).status).toBe(200);
  });

  test('/health sigue respondiendo sin el header', async () => {
    const res = await request(appIp).get('/health');
    expect(res.status).toBe(200);
  });

  test('en la app real, la API y los estáticos quedan bloqueados', async () => {
    expect((await request(app).get('/api/categories/active')).status).toBe(403);
    expect((await request(app).get('/')).status).toBe(403);
    const ok = await request(app).get('/api/categories/active').set('x-edge-auth', SECRETO);
    expect(ok.status).toBe(200);
  });

  test('los sockets aplican la misma regla', async () => {
    expect(permitidoPorBorde({})).toBe(false);
    expect(permitidoPorBorde({ 'x-edge-auth': SECRETO })).toBe(true);

    const server = http.createServer(app);
    initSocket(server, app);
    try {
      const handshake = '/socket.io/?EIO=4&transport=polling';
      expect((await request(server).get(handshake)).status).toBe(403);
      expect((await request(server).get(handshake).set('x-edge-auth', SECRETO)).status).toBe(200);
    } finally {
      getIO()?.close();
    }
  });
});
