import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createCategory } from '../helpers.js';
import { UMBRAL_REPORTES } from '../../src/config/reportConfig.js';

const reportarCategoria = (categoria_id, motivo, cookie) =>
  request(app).post('/api/reports/create').set('Cookie', cookie).send({ categoria_id, motivo });

async function tumbarCategoriaPorReportes(categoriaId) {
  let last;
  for (let i = 0; i < UMBRAL_REPORTES; i++) {
    const u = await registerAndLogin();
    last = await reportarCategoria(categoriaId, 'spam', u.cookie);
    expect(last.status).toBe(201);
  }
  return last;
}

const filaCategoria = async (id) => {
  const { rows } = await pool.query(
    'SELECT estado, motivo_inactivacion, fecha_inactivacion FROM categoria WHERE id = $1', [id]);
  return rows[0] ?? null;
};

const countReportes = async (catId) => {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM reporte WHERE categoria_id = $1', [catId]);
  return rows[0].n;
};

describe('reportes de categoría — validaciones', () => {
  test('reporte válido sobre categoría ajena → 201', async () => {
    const autor = await registerAndLogin();
    const reportante = await registerAndLogin();
    const cat = await createCategory(autor.cookie);

    const res = await reportarCategoria(cat.id, 'spam', reportante.cookie);
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.inactivado).toBe(false);
  });

  test('no se puede reportar categoría propia → 403', async () => {
    const autor = await registerAndLogin();
    const cat = await createCategory(autor.cookie);

    const res = await reportarCategoria(cat.id, 'spam', autor.cookie);
    expect(res.status).toBe(403);
  });

  test('no se puede reportar dos veces la misma categoría → 409', async () => {
    const autor = await registerAndLogin();
    const reportante = await registerAndLogin();
    const cat = await createCategory(autor.cookie);

    const r1 = await reportarCategoria(cat.id, 'spam', reportante.cookie);
    expect(r1.status).toBe(201);

    const r2 = await reportarCategoria(cat.id, 'spam', reportante.cookie);
    expect(r2.status).toBe(409);
  });

  test('categoría inexistente → 404', async () => {
    const reportante = await registerAndLogin();
    const res = await reportarCategoria(999999999, 'spam', reportante.cookie);
    expect(res.status).toBe(404);
  });
});

describe('reportes de categoría — inactivación al cruzar umbral', () => {
  test('al cruzar umbral: categoría inactiva + motivo correcto', async () => {
    const autor = await registerAndLogin();
    const cat = await createCategory(autor.cookie);

    const res = await tumbarCategoriaPorReportes(cat.id);
    expect(res.body.data.inactivado).toBe(true);

    const fila = await filaCategoria(cat.id);
    expect(fila.estado).toBe('inactiva');
    expect(fila.motivo_inactivacion).toBe('moderacion_reporte');
    expect(fila.fecha_inactivacion).not.toBeNull();
  });

  test('antes del umbral la categoría sigue activa', async () => {
    const autor = await registerAndLogin();
    const cat = await createCategory(autor.cookie);

    for (let i = 0; i < UMBRAL_REPORTES - 1; i++) {
      const u = await registerAndLogin();
      const r = await reportarCategoria(cat.id, 'spam', u.cookie);
      expect(r.body.data.inactivado).toBe(false);
    }
    expect((await filaCategoria(cat.id)).estado).toBe('activa');
  });

  test('no se puede reportar categoría ya inactiva → 400', async () => {
    const autor = await registerAndLogin();
    const cat = await createCategory(autor.cookie);

    await tumbarCategoriaPorReportes(cat.id);
    expect((await filaCategoria(cat.id)).estado).toBe('inactiva');

    const tardio = await registerAndLogin();
    const res = await reportarCategoria(cat.id, 'spam', tardio.cookie);
    expect(res.status).toBe(400);
  });
});