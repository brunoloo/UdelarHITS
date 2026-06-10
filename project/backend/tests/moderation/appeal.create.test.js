import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createTopic, createReply } from '../helpers.js';
import { UMBRAL_REPORTES } from '../../src/config/reportConfig.js';

const idOf = (x) => x.id ?? x.contenido_id;

const reportar = (contenido_id, cookie) =>
  request(app).post('/api/reports/create').set('Cookie', cookie).send({ contenido_id, motivo: 'spam' });

const apelar = (contenido_id, justificacion, cookie) =>
  request(app).post('/api/appeals/create').set('Cookie', cookie).send({ contenido_id, justificacion });

// Reporta el contenido con UMBRAL usuarios distintos para tumbarlo por moderación.
async function tumbarPorReportes(contenidoId) {
  for (let i = 0; i < UMBRAL_REPORTES; i++) {
    const u = await registerAndLogin();
    const r = await reportar(contenidoId, u.cookie);
    expect(r.status).toBe(201);
  }
}

describe('apelaciones — creación', () => {
  test('el autor puede apelar su tema inactivado por moderación → 201', async () => {
    const autor = await registerAndLogin();
    const topic = await createTopic(autor.cookie);
    const tid = idOf(topic);

    await tumbarPorReportes(tid);

    const res = await apelar(tid, 'Mi tema no viola ninguna norma', autor.cookie);
    expect(res.status).toBe(201);
    expect(res.body.data.estado).toBe('pendiente');
    expect(res.body.data.titulo).toContain('tema');
  });

  test('no se puede apelar contenido ajeno → 403', async () => {
    const autor = await registerAndLogin();
    const otro = await registerAndLogin();
    const topic = await createTopic(autor.cookie);
    const tid = idOf(topic);

    await tumbarPorReportes(tid);

    const res = await apelar(tid, 'intento apelar lo que no es mío', otro.cookie);
    expect(res.status).toBe(403);
  });

  test('no se puede apelar un tema que NO fue inactivado por moderación → 403', async () => {
    const autor = await registerAndLogin();
    const topic = await createTopic(autor.cookie);
    const tid = idOf(topic);

    // tema activo, nunca reportado → no apelable
    const res = await apelar(tid, 'no debería poder', autor.cookie);
    expect(res.status).toBe(403);
  });

  test('no se puede apelar un comentario caído por ARRASTRE → 403', async () => {
    const autor = await registerAndLogin();
    const otro = await registerAndLogin();
    const topic = await createTopic(autor.cookie);
    const tid = idOf(topic);

    // comentario de "otro" dentro del tema; cae por arrastre cuando el tema es reportado
    const comentario = await createReply(otro.cookie, { tema_id: tid });
    const cid = idOf(comentario);

    await tumbarPorReportes(tid);

    // el comentario está oculto pero por arrastre (inactivado_directo = false) → no apelable
    const res = await apelar(cid, 'mi comentario era válido', otro.cookie);
    expect(res.status).toBe(403);
  });

  test('no se puede apelar dos veces el mismo contenido → 409', async () => {
    const autor = await registerAndLogin();
    const topic = await createTopic(autor.cookie);
    const tid = idOf(topic);

    await tumbarPorReportes(tid);

    const a1 = await apelar(tid, 'primera apelación', autor.cookie);
    expect(a1.status).toBe(201);

    const a2 = await apelar(tid, 'segunda apelación', autor.cookie);
    expect(a2.status).toBe(409);
  });

  test('justificación vacía → 400', async () => {
    const autor = await registerAndLogin();
    const topic = await createTopic(autor.cookie);
    const tid = idOf(topic);
    await tumbarPorReportes(tid);

    const res = await apelar(tid, '   ', autor.cookie);
    expect(res.status).toBe(400);
  });
});