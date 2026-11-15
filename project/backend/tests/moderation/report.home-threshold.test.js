import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createHomeReply } from '../helpers.js';
import { REPORT_THRESHOLD, debeInactivarHome } from '../../src/config/reportConfig.js';

// Los comentarios de Home usan un umbral plano, no la fórmula dual.

const reportar = (contenido_id, cookie) =>
  request(app).post('/api/reports/create').set('Cookie', cookie).send({ contenido_id, motivo: 'spam' });

const estadoComentario = async (id) => {
  const { rows } = await pool.query('SELECT estado FROM comentario WHERE contenido_id = $1', [id]);
  return rows[0]?.estado ?? null;
};

describe('Umbral de reportes de Home — función pura', () => {
  test('debeInactivarHome aplica el umbral de reportConfig.HOME', () => {
    const H = REPORT_THRESHOLD.HOME;
    expect(debeInactivarHome(H - 1)).toBe(false);
    expect(debeInactivarHome(H)).toBe(true);
    expect(debeInactivarHome(H + 5)).toBe(true);
  });
});

describe('Umbral de reportes de Home — integración', () => {
  // Umbral fijado por el test y distinto del piso de visitantes (10), para distinguir que
  // se usa el camino de Home.
  const HOME_TEST = 4;
  const original = REPORT_THRESHOLD.HOME;
  beforeAll(() => { REPORT_THRESHOLD.HOME = HOME_TEST; });
  afterAll(() => { REPORT_THRESHOLD.HOME = original; });

  test(`no cae por el piso de participantes (3) y se inactiva recién en HOME (${HOME_TEST}) reportantes`, async () => {
    const autor = await registerAndLogin();
    const home = await createHomeReply(autor.cookie, { cuerpo: 'comentario reportable de portada' });

    // Con un reporte menos que el umbral sigue visible.
    for (let i = 0; i < HOME_TEST - 1; i++) {
      const u = await registerAndLogin();
      const r = await reportar(home.contenido_id, u.cookie);
      expect(r.status).toBe(201);
    }
    expect(await estadoComentario(home.contenido_id)).toBe('visible');

    // El reporte que alcanza el umbral lo oculta.
    const ultimo = await registerAndLogin();
    const r = await reportar(home.contenido_id, ultimo.cookie);
    expect(r.status).toBe(201);
    expect(await estadoComentario(home.contenido_id)).toBe('oculto');
  });
});
