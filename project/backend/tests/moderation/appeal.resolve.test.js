import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createAdmin, createTopic, createReply, createCategory, makeParticipant } from '../helpers.js';
import { UMBRAL_REPORTES } from '../../src/config/reportConfig.js';

const idOf = (x) => x.id ?? x.contenido_id;

const reportar = (contenido_id, cookie) =>
  request(app).post('/api/reports/create').set('Cookie', cookie).send({ contenido_id, motivo: 'spam' });
const apelar = (contenido_id, justificacion, cookie) =>
  request(app).post('/api/appeals/create').set('Cookie', cookie).send({ contenido_id, justificacion });
const resolver = (apelacionId, decision, cookie) =>
  request(app).patch(`/api/appeals/${apelacionId}/resolve`).set('Cookie', cookie).send({ decision });

async function categoriaDeContenido(contenidoId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(t.categoria_id, c.categoria_id, tt.categoria_id) AS categoria_id
     FROM contenido con
     LEFT JOIN tema t ON t.contenido_id = con.id
     LEFT JOIN comentario c ON c.contenido_id = con.id
     LEFT JOIN tema tt ON tt.contenido_id = c.tema_id
     WHERE con.id = $1`, [contenidoId]);
  return rows[0]?.categoria_id;
}

async function tumbarPorReportes(contenidoId) {
  const catId = await categoriaDeContenido(contenidoId);
  for (let i = 0; i < UMBRAL_REPORTES; i++) {
    const u = await makeParticipant(catId);
    expect((await reportar(contenidoId, u.cookie)).status).toBe(201);
  }
}

// Verificación directa contra la BD
const contenidoExiste = async (id) => {
  const { rows } = await pool.query('SELECT 1 FROM contenido WHERE id = $1', [id]);
  return rows.length > 0;
};
const estadoTema = async (id) => {
  const { rows } = await pool.query('SELECT estado FROM tema WHERE contenido_id = $1', [id]);
  return rows[0]?.estado ?? null;
};
const estadoComentario = async (id) => {
  const { rows } = await pool.query('SELECT estado FROM comentario WHERE contenido_id = $1', [id]);
  return rows[0]?.estado ?? null;
};
const contadorTemas = async (catId) => {
  const { rows } = await pool.query('SELECT contador_temas FROM categoria WHERE id = $1', [catId]);
  return rows[0]?.contador_temas ?? null;
};
const countReportes = async (id) => {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM reporte WHERE contenido_id = $1', [id]);
  return rows[0].n;
};
const appealExiste = async (id) => {
  const { rows } = await pool.query('SELECT 1 FROM apelacion WHERE id = $1', [id]);
  return rows.length > 0;
};

describe('resolver apelación de TEMA', () => {
  test('ACEPTAR: tema vuelve activo, árbol restaurado, contador re-incrementado, reportes borrados, apelación borrada', async () => {
    const autor = await registerAndLogin();
    const otro = await registerAndLogin();
    const admin = await createAdmin();
    const cat = await createCategory(autor.cookie);
    const topic = await createTopic(autor.cookie, { categoria_id: cat.id });
    const tid = idOf(topic);

    const c1 = await createReply(otro.cookie, { tema_id: tid });

    const contadorInicial = await contadorTemas(cat.id);
    await tumbarPorReportes(tid);
    expect(await estadoTema(tid)).toBe('inactivo');
    expect(await contadorTemas(cat.id)).toBe(contadorInicial - 1);

    const ap = await apelar(tid, 'apelo de buena fe', autor.cookie);
    const apId = ap.body.data.id;

    const res = await resolver(apId, 'aceptar', admin.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.decision).toBe('aceptada');

    // tema activo de nuevo
    expect(await estadoTema(tid)).toBe('activo');
    // comentario arrastrado restaurado
    expect(await estadoComentario(idOf(c1))).toBe('visible');
    // contador devuelto a su valor original
    expect(await contadorTemas(cat.id)).toBe(contadorInicial);
    // reportes borrados (no vuelve a caer)
    expect(await countReportes(tid)).toBe(0);
    // apelación eliminada
    expect(await appealExiste(apId)).toBe(false);
  });

  test('RECHAZAR: hard delete del árbol completo (tema + comentarios desaparecen)', async () => {
    const autor = await registerAndLogin();
    const otro = await registerAndLogin();
    const admin = await createAdmin();
    const topic = await createTopic(autor.cookie);
    const tid = idOf(topic);

    const c1 = await createReply(otro.cookie, { tema_id: tid });
    const c2 = await createReply(otro.cookie, { tema_id: tid });

    await tumbarPorReportes(tid);
    const ap = await apelar(tid, 'apelo', autor.cookie);
    const apId = ap.body.data.id;

    const res = await resolver(apId, 'rechazar', admin.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.decision).toBe('rechazada');

    // todo el árbol desapareció de la BD
    expect(await contenidoExiste(tid)).toBe(false);
    expect(await contenidoExiste(idOf(c1))).toBe(false);
    expect(await contenidoExiste(idOf(c2))).toBe(false);
    // apelación eliminada
    expect(await appealExiste(apId)).toBe(false);
  });
});

describe('resolver apelación de COMENTARIO', () => {
  test('ACEPTAR: comentario vuelve a visible, reportes borrados', async () => {
    const autor = await registerAndLogin();
    const admin = await createAdmin();
    const topic = await createTopic(autor.cookie);
    const tid = idOf(topic);
    const comentario = await createReply(autor.cookie, { tema_id: tid });
    const cid = idOf(comentario);

    await tumbarPorReportes(cid);
    expect(await estadoComentario(cid)).toBe('oculto');

    const ap = await apelar(cid, 'apelo comentario', autor.cookie);
    const res = await resolver(ap.body.data.id, 'aceptar', admin.cookie);
    expect(res.status).toBe(200);

    expect(await estadoComentario(cid)).toBe('visible');
    expect(await countReportes(cid)).toBe(0);
  });

  test('RECHAZAR: hard delete del subárbol del comentario', async () => {
    const autor = await registerAndLogin();
    const otro = await registerAndLogin();
    const admin = await createAdmin();
    const topic = await createTopic(autor.cookie);
    const tid = idOf(topic);
    const comentario = await createReply(autor.cookie, { tema_id: tid });
    const cid = idOf(comentario);
    // una respuesta colgando del comentario
    const respuesta = await createReply(otro.cookie, { tema_id: tid, comentario_padre_id: cid });

    await tumbarPorReportes(cid);
    const ap = await apelar(cid, 'apelo', autor.cookie);
    const res = await resolver(ap.body.data.id, 'rechazar', admin.cookie);
    expect(res.status).toBe(200);

    // comentario y su respuesta desaparecen
    expect(await contenidoExiste(cid)).toBe(false);
    expect(await contenidoExiste(idOf(respuesta))).toBe(false);
    // el tema sigue existiendo (no era parte del subárbol)
    expect(await contenidoExiste(tid)).toBe(true);
  });
});

describe('resolver apelación — permisos y validación', () => {
  test('un usuario no-admin NO puede resolver → 403', async () => {
    const autor = await registerAndLogin();
    const noAdmin = await registerAndLogin();
    const topic = await createTopic(autor.cookie);
    const tid = idOf(topic);
    await tumbarPorReportes(tid);
    const ap = await apelar(tid, 'apelo', autor.cookie);

    const res = await resolver(ap.body.data.id, 'aceptar', noAdmin.cookie);
    expect(res.status).toBe(403);
  });

  test('decisión inválida → 400', async () => {
    const autor = await registerAndLogin();
    const admin = await createAdmin();
    const topic = await createTopic(autor.cookie);
    const tid = idOf(topic);
    await tumbarPorReportes(tid);
    const ap = await apelar(tid, 'apelo', autor.cookie);

    const res = await resolver(ap.body.data.id, 'tal_vez', admin.cookie);
    expect(res.status).toBe(400);
  });

  test('apelación inexistente → 404', async () => {
    const admin = await createAdmin();
    const res = await resolver(999999999, 'aceptar', admin.cookie);
    expect(res.status).toBe(404);
  });
});

describe('listar apelaciones pendientes (admin)', () => {
  test('lista por tipo y solo trae pendientes', async () => {
    const autor = await registerAndLogin();
    const admin = await createAdmin();
    const topic = await createTopic(autor.cookie);
    const tid = idOf(topic);
    await tumbarPorReportes(tid);
    await apelar(tid, 'apelo', autor.cookie);

    const res = await request(app).get('/api/appeals/pending?tipo=tema').set('Cookie', admin.cookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some(a => idOf({ contenido_id: a.contenido_id }) === tid || a.contenido_id === tid)).toBe(true);
  });

  test('no-admin no puede listar → 403', async () => {
    const noAdmin = await registerAndLogin();
    const res = await request(app).get('/api/appeals/pending?tipo=tema').set('Cookie', noAdmin.cookie);
    expect(res.status).toBe(403);
  });
});