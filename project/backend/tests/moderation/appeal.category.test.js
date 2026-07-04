import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createAdmin, createCategory, makeParticipant } from '../helpers.js';
import { UMBRAL_REPORTES } from '../../src/config/reportConfig.js';

const reportarCategoria = (categoria_id, cookie) =>
  request(app).post('/api/reports/create').set('Cookie', cookie).send({ categoria_id, motivo: 'spam' });
const apelarCategoria = (categoria_id, justificacion, cookie) =>
  request(app).post('/api/appeals/create').set('Cookie', cookie).send({ categoria_id, justificacion });
const resolver = (apelacionId, decision, cookie) =>
  request(app).patch(`/api/appeals/${apelacionId}/resolve`).set('Cookie', cookie).send({ decision });

// Tumba la categoría con UMBRAL participantes reportándola (reportes con peso).
async function tumbarCategoria(categoriaId) {
  for (let i = 0; i < UMBRAL_REPORTES; i++) {
    const u = await makeParticipant(categoriaId);
    expect((await reportarCategoria(categoriaId, u.cookie)).status).toBe(201);
  }
}

const categoriaExiste = async (id) => {
  const { rows } = await pool.query('SELECT 1 FROM categoria WHERE id = $1', [id]);
  return rows.length > 0;
};
const estadoCategoria = async (id) => {
  const { rows } = await pool.query('SELECT estado FROM categoria WHERE id = $1', [id]);
  return rows[0]?.estado ?? null;
};
const countReportesCat = async (id) => {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM reporte WHERE categoria_id = $1', [id]);
  return rows[0].n;
};
const appealExiste = async (id) => {
  const { rows } = await pool.query('SELECT 1 FROM apelacion WHERE id = $1', [id]);
  return rows.length > 0;
};

describe('apelaciones de categoría — creación', () => {
  test('el autor puede apelar su categoría inactivada por moderación → 201', async () => {
    const autor = await registerAndLogin();
    const cat = await createCategory(autor.cookie);
    await tumbarCategoria(cat.id);

    const res = await apelarCategoria(cat.id, 'Mi categoría es legítima', autor.cookie);
    expect(res.status).toBe(201);
    expect(res.body.data.estado).toBe('pendiente');
  });

  test('no se puede apelar categoría ajena → 403', async () => {
    const autor = await registerAndLogin();
    const otro = await registerAndLogin();
    const cat = await createCategory(autor.cookie);
    await tumbarCategoria(cat.id);

    const res = await apelarCategoria(cat.id, 'no es mía', otro.cookie);
    expect(res.status).toBe(403);
  });

  test('no se puede apelar categoría activa → 403', async () => {
    const autor = await registerAndLogin();
    const cat = await createCategory(autor.cookie);

    const res = await apelarCategoria(cat.id, 'no debería poder', autor.cookie);
    expect(res.status).toBe(403);
  });

  test('no se puede apelar dos veces → 409', async () => {
    const autor = await registerAndLogin();
    const cat = await createCategory(autor.cookie);
    await tumbarCategoria(cat.id);

    const a1 = await apelarCategoria(cat.id, 'primera', autor.cookie);
    expect(a1.status).toBe(201);

    const a2 = await apelarCategoria(cat.id, 'segunda', autor.cookie);
    expect(a2.status).toBe(409);
  });
});

describe('resolver apelación de CATEGORÍA', () => {
  test('ACEPTAR: categoría vuelve a activa, reportes borrados, apelación borrada', async () => {
    const autor = await registerAndLogin();
    const admin = await createAdmin();
    const cat = await createCategory(autor.cookie);
    await tumbarCategoria(cat.id);
    expect(await estadoCategoria(cat.id)).toBe('inactiva');

    const ap = await apelarCategoria(cat.id, 'apelo', autor.cookie);
    const apId = ap.body.data.id;

    const res = await resolver(apId, 'aceptar', admin.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.decision).toBe('aceptada');

    expect(await estadoCategoria(cat.id)).toBe('activa');
    expect(await countReportesCat(cat.id)).toBe(0);
    expect(await appealExiste(apId)).toBe(false);
  });

  test('RECHAZAR: categoría eliminada definitivamente', async () => {
    const autor = await registerAndLogin();
    const admin = await createAdmin();
    const cat = await createCategory(autor.cookie);
    await tumbarCategoria(cat.id);

    const ap = await apelarCategoria(cat.id, 'apelo', autor.cookie);
    const apId = ap.body.data.id;

    const res = await resolver(apId, 'rechazar', admin.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.decision).toBe('rechazada');

    expect(await categoriaExiste(cat.id)).toBe(false);
    expect(await appealExiste(apId)).toBe(false);
  });
});