import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createHomeReply } from '../helpers.js';
import { REPORT_THRESHOLD, debeInactivarHome } from '../../src/config/reportConfig.js';

// Los comentarios de Home no tienen categoría → no hay participantes ni
// comunidad que ponderen el reporte. Usan un umbral PLANO y explícito
// (reportConfig.HOME), no el default de la fórmula dual "por accidente".

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
  // El test fija el umbral por sí mismo (no depende de UMBRAL_HOME del entorno,
  // que en un clon limpio / CI no existe). Se elige un valor DISTINTO del piso de
  // visitantes de la fórmula de categoría (umbralVisitantes(0) = 10) para que el
  // test DISTINGA que report.service usa el camino de Home: si usara la fórmula
  // de categoría, un comentario de Home (0 participantes) recién caería a los 10
  // reportes, no a los HOME_TEST de acá.
  const HOME_TEST = 4;
  const original = REPORT_THRESHOLD.HOME;
  beforeAll(() => { REPORT_THRESHOLD.HOME = HOME_TEST; });
  afterAll(() => { REPORT_THRESHOLD.HOME = original; });

  test(`no cae por el piso de participantes (3) y se inactiva recién en HOME (${HOME_TEST}) reportantes`, async () => {
    const autor = await registerAndLogin();
    const home = await createHomeReply(autor.cookie, { cuerpo: 'comentario reportable de portada' });

    // HOME_TEST-1 reportantes distintos: sigue visible. En particular, con 3
    // reportes NO se oculta (probaría que usa el piso de participantes = 3).
    for (let i = 0; i < HOME_TEST - 1; i++) {
      const u = await registerAndLogin();
      const r = await reportar(home.contenido_id, u.cookie);
      expect(r.status).toBe(201);
    }
    expect(await estadoComentario(home.contenido_id)).toBe('visible');

    // El reporte número HOME_TEST alcanza el umbral de Home → oculto. Como
    // HOME_TEST (4) ≠ 10, esto sólo pasa si se usa el camino de Home.
    const ultimo = await registerAndLogin();
    const r = await reportar(home.contenido_id, ultimo.cookie);
    expect(r.status).toBe(201);
    expect(await estadoComentario(home.contenido_id)).toBe('oculto');
  });
});
