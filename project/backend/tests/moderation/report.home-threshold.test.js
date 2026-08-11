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
  test('debeInactivarHome aplica el umbral plano de reportConfig.HOME', () => {
    const H = REPORT_THRESHOLD.HOME;
    expect(debeInactivarHome(H - 1)).toBe(false);
    expect(debeInactivarHome(H)).toBe(true);
    expect(debeInactivarHome(H + 5)).toBe(true);
  });
});

describe('Umbral de reportes de Home — integración', () => {
  test(`no cae por el piso de participantes (3) y se inactiva recién al llegar a HOME (${REPORT_THRESHOLD.HOME}) reportantes`, async () => {
    const autor = await registerAndLogin();
    const home = await createHomeReply(autor.cookie, { cuerpo: 'comentario reportable de portada' });
    const H = REPORT_THRESHOLD.HOME;

    // H-1 reportantes distintos: sigue visible. En particular, con 3 reportes NO
    // se oculta (probaría que usa la fórmula de categoría, cuyo piso es 3).
    for (let i = 0; i < H - 1; i++) {
      const u = await registerAndLogin();
      const r = await reportar(home.contenido_id, u.cookie);
      expect(r.status).toBe(201);
    }
    expect(await estadoComentario(home.contenido_id)).toBe('visible');

    // El reporte número H alcanza el umbral de Home → oculto.
    const ultimo = await registerAndLogin();
    const r = await reportar(home.contenido_id, ultimo.cookie);
    expect(r.status).toBe(201);
    expect(await estadoComentario(home.contenido_id)).toBe('oculto');
  });
});
