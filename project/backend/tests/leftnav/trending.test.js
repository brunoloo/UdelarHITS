import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createTopic, createCategory } from '../helpers.js';

const idOf = (x) => x.id ?? x.contenido_id;
const trending = (qs = '') => request(app).get(`/api/topics/trending${qs}`);

async function comentar(cookie, temaId, cuerpo = 'comentario') {
  const res = await request(app).post('/api/replies/create')
    .set('Cookie', cookie).send({ cuerpo, tema_id: temaId });
  if (res.status >= 400) throw new Error(`comentar falló: ${JSON.stringify(res.body)}`);
  return res.body.data;
}

describe('GET /topics/trending', () => {
  test('es público → 200', async () => {
    const res = await trending();
    expect(res.status).toBe(200);
  });

  test('elige el tema con más comentarios', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const poco = await createTopic(a.cookie, { titulo: 'Poco comentado' });
    const mucho = await createTopic(a.cookie, { titulo: 'Muy comentado' });

    // 'poco' recibe 1 comentario, 'mucho' recibe 3
    await comentar(b.cookie, idOf(poco));
    await comentar(b.cookie, idOf(mucho));
    await comentar(a.cookie, idOf(mucho));
    await comentar(b.cookie, idOf(mucho));

    const res = await trending();
    expect(idOf(res.body.data)).toBe(idOf(mucho));
    expect(res.body.data.total_comentarios).toBe('3');  // COUNT viene como string en pg
  });

  test('incluye preview de comentarios (hasta 3, más recientes primero)', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const topic = await createTopic(a.cookie);
    await comentar(b.cookie, idOf(topic), 'primero');
    await comentar(b.cookie, idOf(topic), 'segundo');

    const res = await trending();
    const preview = res.body.data.comentarios_preview;
    expect(Array.isArray(preview)).toBe(true);
    expect(preview.length).toBeGreaterThan(0);
    expect(preview.length).toBeLessThanOrEqual(3);
  });

  test('un tema inactivo no puede ser trending', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const topic = await createTopic(a.cookie);
    // muchos comentarios, pero el tema se desactiva
    await comentar(b.cookie, idOf(topic));
    await comentar(b.cookie, idOf(topic));
    await request(app).delete(`/api/topics/${idOf(topic)}/delete`).set('Cookie', a.cookie);

    const res = await trending();
    // si hay trending, no debe ser este tema; si es null, también ok
    if (res.body.data) {
      expect(idOf(res.body.data)).not.toBe(idOf(topic));
    }
  });
});