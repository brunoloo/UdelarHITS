// Defensa 1: límite duro de conversaciones de chat activas simultáneas.
// El límite se achica por env ANTES de importar nada para poder probarlo
// sin abrir cientos de conversaciones.
process.env.CHAT_MAX_ACTIVE_CONVERSATIONS = '2';

import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin } from '../helpers.js';
import { _resetChatLoad, getActiveConversationCount } from '../../src/utils/chatLoad.js';

const abrir = (cookie, nickname) =>
  request(app).get(`/api/chat/conversations/${nickname}`).set('Cookie', cookie);

const enviar = (cookie, convId, cuerpo) =>
  request(app).post(`/api/chat/conversations/${convId}/messages`).set('Cookie', cookie).send({ cuerpo });

let a, b, c, d;

beforeEach(async () => {
  _resetChatLoad();
  a = await registerAndLogin();
  b = await registerAndLogin();
  c = await registerAndLogin();
  d = await registerAndLogin();
});

// Los tests corren --runInBand (mismo proceso): limpiar el env para no
// contaminar a los archivos de test que corren después.
afterAll(() => {
  delete process.env.CHAT_MAX_ACTIVE_CONVERSATIONS;
});

describe('límite de conversaciones activas (CHAT_MAX_ACTIVE_CONVERSATIONS=2)', () => {
  test('la conversación N+1 se rechaza con 503 sin afectar a las N anteriores', async () => {
    const conv1 = await abrir(a.cookie, b.user.nickname);
    expect(conv1.status).toBe(200);
    const conv2 = await abrir(a.cookie, c.user.nickname);
    expect(conv2.status).toBe(200);

    // Tercera conversación: al máximo → rechazo claro, no un error genérico.
    const conv3 = await abrir(a.cookie, d.user.nickname);
    expect(conv3.status).toBe(503);
    expect(conv3.body.message).toMatch(/chat está muy activo/i);

    // Las dos conversaciones previas siguen funcionando con normalidad.
    const msg1 = await enviar(a.cookie, conv1.body.data.conversacion_id, 'hola b');
    expect(msg1.status).toBe(201);
    const msg2 = await enviar(a.cookie, conv2.body.data.conversacion_id, 'hola c');
    expect(msg2.status).toBe(201);
  });

  test('reabrir una conversación ya activa NO cuenta como nueva (no se bloquea)', async () => {
    await abrir(a.cookie, b.user.nickname);
    await abrir(a.cookie, c.user.nickname);
    // a reabre la conversación con b (ya activa) estando al máximo → permitido.
    const reopen = await abrir(a.cookie, b.user.nickname);
    expect(reopen.status).toBe(200);
    // Y el otro participante también puede abrirla.
    const otherSide = await abrir(b.cookie, a.user.nickname);
    expect(otherSide.status).toBe(200);
  });

  test('cerrar una conversación libera el lugar para otra nueva', async () => {
    const conv1 = await abrir(a.cookie, b.user.nickname);
    await abrir(a.cookie, c.user.nickname);

    // Al máximo: d no puede abrir.
    expect((await abrir(d.cookie, a.user.nickname)).status).toBe(503);

    // a cierra la conversación con b (único participante activo) → libera cupo.
    const del = await request(app)
      .delete(`/api/chat/conversations/${conv1.body.data.conversacion_id}`)
      .set('Cookie', a.cookie);
    expect(del.status).toBe(200);

    // Ahora d sí puede abrir una conversación nueva.
    expect((await abrir(d.cookie, a.user.nickname)).status).toBe(200);
  });

  test('una conversación inactiva más allá del TTL libera su lugar', async () => {
    // TTL corto solo para este test (lectura perezosa del env). No se asserta
    // el conteo intermedio: el tiempo de las requests podría barrer antes.
    process.env.CHAT_ACTIVE_TTL_MS = '200';
    try {
      await abrir(a.cookie, b.user.nickname);
      await abrir(a.cookie, c.user.nickname);
      await new Promise(r => setTimeout(r, 250));
      // El sweep perezoso corre en la próxima operación: ambas conversaciones
      // vencieron y la nueva entra aunque el máximo sea 2.
      const conv3 = await abrir(a.cookie, d.user.nickname);
      expect(conv3.status).toBe(200);
      expect(getActiveConversationCount()).toBe(1);
    } finally {
      delete process.env.CHAT_ACTIVE_TTL_MS;
    }
  });
});
