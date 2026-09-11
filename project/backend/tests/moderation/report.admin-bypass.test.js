import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createAdmin, createCategory, createTopic, createReply, createHomeReply } from '../helpers.js';

const idOf = (x) => x.id ?? x.contenido_id;

const reportar = (body, cookie) =>
  request(app).post('/api/reports/create').set('Cookie', cookie).send(body);

const apelar = (body, cookie) =>
  request(app).post('/api/appeals/create').set('Cookie', cookie).send(body);

// Verificación directa contra la BD
const filaTema = async (id) => {
  const { rows } = await pool.query(
    'SELECT estado, motivo_inactivacion, inactivado_directo FROM tema WHERE contenido_id = $1', [id]);
  return rows[0] ?? null;
};
const filaComentario = async (id) => {
  const { rows } = await pool.query(
    'SELECT estado, motivo_inactivacion, inactivado_directo FROM comentario WHERE contenido_id = $1', [id]);
  return rows[0] ?? null;
};
const filaCategoria = async (id) => {
  const { rows } = await pool.query(
    'SELECT estado, motivo_inactivacion FROM categoria WHERE id = $1', [id]);
  return rows[0] ?? null;
};

describe('reportes de admin — ocultamiento inmediato (bypass del umbral)', () => {
  test('TEMA: un solo reporte de admin lo inactiva en el acto', async () => {
    const autor = await registerAndLogin();
    const admin = await createAdmin();
    const cat = await createCategory(autor.cookie);
    const topic = await createTopic(autor.cookie, { categoria_id: cat.id });
    const tid = idOf(topic);

    const res = await reportar({ contenido_id: tid, motivo: 'spam' }, admin.cookie);
    expect(res.status).toBe(201);
    expect(res.body.data.inactivado).toBe(true);
    expect(res.body.data.total_reportes).toBe(1);

    const tema = await filaTema(tid);
    expect(tema.estado).toBe('inactivo');
    expect(tema.motivo_inactivacion).toBe('moderacion_reporte');
    expect(tema.inactivado_directo).toBe(true);
  });

  test('COMENTARIO de categoría: un solo reporte de admin lo oculta en el acto', async () => {
    const autor = await registerAndLogin();
    const admin = await createAdmin();
    const topic = await createTopic(autor.cookie);
    const reply = await createReply(autor.cookie, { tema_id: idOf(topic) });
    const cid = idOf(reply);

    const res = await reportar({ contenido_id: cid, motivo: 'spam' }, admin.cookie);
    expect(res.status).toBe(201);
    expect(res.body.data.inactivado).toBe(true);
    expect(res.body.data.total_reportes).toBe(1);

    const com = await filaComentario(cid);
    expect(com.estado).toBe('oculto');
    expect(com.motivo_inactivacion).toBe('moderacion_reporte');
    expect(com.inactivado_directo).toBe(true);
  });

  // El comentario de Home no usa el umbral dual sino el plano (reportConfig.HOME,
  // bastante más alto). Esto verifica que el bypass del admin corre ANTES de ese
  // camino, no que el umbral de Home se haya alcanzado.
  test('COMENTARIO de Home: un solo reporte de admin lo oculta, sin pasar por el umbral plano', async () => {
    const autor = await registerAndLogin();
    const admin = await createAdmin();
    const reply = await createHomeReply(autor.cookie);
    const cid = idOf(reply);

    const res = await reportar({ contenido_id: cid, motivo: 'spam' }, admin.cookie);
    expect(res.status).toBe(201);
    expect(res.body.data.inactivado).toBe(true);
    expect(res.body.data.total_reportes).toBe(1);

    const com = await filaComentario(cid);
    expect(com.estado).toBe('oculto');
    expect(com.motivo_inactivacion).toBe('moderacion_reporte');
    expect(com.inactivado_directo).toBe(true);
  });

  test('CATEGORÍA: un solo reporte de admin la inactiva en el acto', async () => {
    const autor = await registerAndLogin();
    const admin = await createAdmin();
    const cat = await createCategory(autor.cookie);

    const res = await reportar({ categoria_id: cat.id, motivo: 'spam' }, admin.cookie);
    expect(res.status).toBe(201);
    expect(res.body.data.inactivado).toBe(true);
    expect(res.body.data.total_reportes).toBe(1);

    const fila = await filaCategoria(cat.id);
    expect(fila.estado).toBe('inactiva');
    expect(fila.motivo_inactivacion).toBe('moderacion_reporte');
  });
});

describe('reportes de admin — contraste con rol user', () => {
  test('un solo reporte de un user NO inactiva el tema', async () => {
    const autor = await registerAndLogin();
    const otro = await registerAndLogin();
    const topic = await createTopic(autor.cookie);
    const tid = idOf(topic);

    const res = await reportar({ contenido_id: tid, motivo: 'spam' }, otro.cookie);
    expect(res.status).toBe(201);
    expect(res.body.data.inactivado).toBe(false);
    expect((await filaTema(tid)).estado).toBe('activo');
  });

  test('un solo reporte de un user NO inactiva la categoría', async () => {
    const autor = await registerAndLogin();
    const otro = await registerAndLogin();
    const cat = await createCategory(autor.cookie);

    const res = await reportar({ categoria_id: cat.id, motivo: 'spam' }, otro.cookie);
    expect(res.status).toBe(201);
    expect(res.body.data.inactivado).toBe(false);
    expect((await filaCategoria(cat.id)).estado).toBe('activa');
  });
});

describe('reportes de admin — las validaciones siguen aplicando', () => {
  test('el admin no puede reportar su propio contenido → 403', async () => {
    const admin = await createAdmin();
    const topic = await createTopic(admin.cookie);

    const res = await reportar({ contenido_id: idOf(topic), motivo: 'spam' }, admin.cookie);
    expect(res.status).toBe(403);
  });

  test('el admin no puede reportar su propia categoría → 403', async () => {
    const admin = await createAdmin();
    const cat = await createCategory(admin.cookie);

    const res = await reportar({ categoria_id: cat.id, motivo: 'spam' }, admin.cookie);
    expect(res.status).toBe(403);
  });

  test('el admin no puede reportar dos veces el mismo contenido → 409', async () => {
    const autor = await registerAndLogin();
    const admin = await createAdmin();
    const topic = await createTopic(autor.cookie);
    const tid = idOf(topic);

    // El primero ya lo deja inactivo; el segundo choca antes con el estado, así
    // que para probar el duplicado se usa un comentario que sigue visible.
    expect((await reportar({ contenido_id: tid, motivo: 'spam' }, admin.cookie)).status).toBe(201);

    const otroAutor = await registerAndLogin();
    const cat = await createCategory(otroAutor.cookie);
    const reply = await createReply(otroAutor.cookie, { categoria_id: cat.id });
    const cid = idOf(reply);

    // Se limpia el ocultamiento para aislar el UNIQUE del chequeo de estado.
    expect((await reportar({ contenido_id: cid, motivo: 'spam' }, admin.cookie)).status).toBe(201);
    await pool.query(
      `UPDATE comentario SET estado = 'visible', motivo_inactivacion = NULL, inactivado_directo = FALSE
       WHERE contenido_id = $1`, [cid]);

    const dup = await reportar({ contenido_id: cid, motivo: 'acoso' }, admin.cookie);
    expect(dup.status).toBe(409);
  });

  test('el admin no puede reportar contenido ya inactivo → 400', async () => {
    const autor = await registerAndLogin();
    const admin1 = await createAdmin();
    const admin2 = await createAdmin();
    const topic = await createTopic(autor.cookie);
    const tid = idOf(topic);

    expect((await reportar({ contenido_id: tid, motivo: 'spam' }, admin1.cookie)).status).toBe(201);

    const res = await reportar({ contenido_id: tid, motivo: 'spam' }, admin2.cookie);
    expect(res.status).toBe(400);
  });

  test('motivo inválido → 400 también para el admin', async () => {
    const autor = await registerAndLogin();
    const admin = await createAdmin();
    const topic = await createTopic(autor.cookie);

    const res = await reportar({ contenido_id: idOf(topic), motivo: 'no_existe' }, admin.cookie);
    expect(res.status).toBe(400);
    expect((await filaTema(idOf(topic))).estado).toBe('activo');
  });
});

describe('reportes de admin — la apelación del autor sigue funcionando', () => {
  test('el autor puede apelar el tema que tumbó un admin → 201', async () => {
    const autor = await registerAndLogin();
    const admin = await createAdmin();
    const topic = await createTopic(autor.cookie);
    const tid = idOf(topic);

    expect((await reportar({ contenido_id: tid, motivo: 'spam' }, admin.cookie)).status).toBe(201);

    const res = await apelar({ contenido_id: tid, justificacion: 'Mi tema no viola ninguna norma' }, autor.cookie);
    expect(res.status).toBe(201);
    expect(res.body.data.estado).toBe('pendiente');
  });

  test('el autor puede apelar la categoría que tumbó un admin → 201', async () => {
    const autor = await registerAndLogin();
    const admin = await createAdmin();
    const cat = await createCategory(autor.cookie);

    expect((await reportar({ categoria_id: cat.id, motivo: 'spam' }, admin.cookie)).status).toBe(201);

    const res = await apelar({ categoria_id: cat.id, justificacion: 'Mi categoría es legítima' }, autor.cookie);
    expect(res.status).toBe(201);
    expect(res.body.data.estado).toBe('pendiente');
  });
});
