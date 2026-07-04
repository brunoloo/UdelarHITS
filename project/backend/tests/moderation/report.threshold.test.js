import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createTopic, createReply, createCategory, makeParticipant } from '../helpers.js';
import { UMBRAL_REPORTES } from '../../src/config/reportConfig.js';

const idOf = (x) => x.id ?? x.contenido_id;

const reportar = (contenido_id, motivo, cookie) =>
  request(app).post('/api/reports/create').set('Cookie', cookie).send({ contenido_id, motivo });

// Registra N reportantes PARTICIPANTES de la categoría (sus reportes pesan más)
// y reporta el contenido con cada uno. En una categoría chica, UMBRAL_REPORTES
// participantes alcanzan la cota de ocultamiento. Devuelve el último reporte.
async function reportarHastaUmbral(contenidoId, categoriaId, n = UMBRAL_REPORTES) {
  let last;
  for (let i = 0; i < n; i++) {
    const u = await makeParticipant(categoriaId);
    last = await reportar(contenidoId, 'spam', u.cookie);
    expect(last.status).toBe(201);
  }
  return last;
}

// Verificación directa contra la BD
const filaTema = async (id) => {
  const { rows } = await pool.query(
    'SELECT estado, motivo_inactivacion, inactivado_directo, fecha_inactivacion FROM tema WHERE contenido_id = $1', [id]);
  return rows[0] ?? null;
};
const filaComentario = async (id) => {
  const { rows } = await pool.query(
    'SELECT estado, motivo_inactivacion, inactivado_directo, fecha_inactivacion FROM comentario WHERE contenido_id = $1', [id]);
  return rows[0] ?? null;
};
const contadorTemas = async (categoriaId) => {
  const { rows } = await pool.query('SELECT contador_temas FROM categoria WHERE id = $1', [categoriaId]);
  return rows[0]?.contador_temas ?? null;
};

describe('reportes — inactivación de TEMA al cruzar umbral', () => {
  test('al cruzar umbral: tema inactivo + comentarios ocultos + contador decrementado', async () => {
    const autor = await registerAndLogin();
    const otro = await registerAndLogin();
    const cat = await createCategory(autor.cookie);
    const topic = await createTopic(autor.cookie, { categoria_id: cat.id });
    const tid = idOf(topic);

    // dos comentarios de otro usuario (no se reportan; deben caer por arrastre)
    const c1 = await createReply(otro.cookie, { tema_id: tid });
    const c2 = await createReply(otro.cookie, { tema_id: tid });

    const contadorAntes = await contadorTemas(cat.id);

    const res = await reportarHastaUmbral(tid, cat.id);
    expect(res.body.data.inactivado).toBe(true);

    // tema: inactivo, marcado por reporte, directo
    const tema = await filaTema(tid);
    expect(tema.estado).toBe('inactivo');
    expect(tema.motivo_inactivacion).toBe('moderacion_reporte');
    expect(tema.inactivado_directo).toBe(true);
    expect(tema.fecha_inactivacion).not.toBeNull();

    // comentarios: siguen visibles
    for (const c of [c1, c2]) {
      const com = await filaComentario(idOf(c));
      expect(com.estado).toBe('visible');
      expect(com.motivo_inactivacion).toBeNull();
    }

    // contador decrementado en 1
    expect(await contadorTemas(cat.id)).toBe(contadorAntes - 1);
  });

  test('antes del umbral el tema sigue activo', async () => {
    const autor = await registerAndLogin();
    const cat = await createCategory(autor.cookie);
    const topic = await createTopic(autor.cookie, { categoria_id: cat.id });
    const tid = idOf(topic);

    // un reporte participante menos que el umbral
    for (let i = 0; i < UMBRAL_REPORTES - 1; i++) {
      const u = await makeParticipant(cat.id);
      const r = await reportar(tid, 'spam', u.cookie);
      expect(r.body.data.inactivado).toBe(false);
    }
    expect((await filaTema(tid)).estado).toBe('activo');
  });
});

describe('reportes — inactivación de COMENTARIO al cruzar umbral', () => {
  test('comentario reportado cae como placeholder, su subárbol queda intacto', async () => {
    const autor = await registerAndLogin();
    const otro = await registerAndLogin();
    const cat = await createCategory(autor.cookie);
    const topic = await createTopic(autor.cookie, { categoria_id: cat.id });
    const tid = idOf(topic);

    // comentario que vamos a reportar
    const comentario = await createReply(autor.cookie, { tema_id: tid });
    const cid = idOf(comentario);

    // una respuesta de OTRO usuario colgando del comentario (no debe caer)
    const respuesta = await createReply(otro.cookie, { tema_id: tid, comentario_padre_id: cid });

    const res = await reportarHastaUmbral(cid, cat.id);
    expect(res.body.data.inactivado).toBe(true);

    // el comentario: oculto, directo (apelable en 4.B)
    const com = await filaComentario(cid);
    expect(com.estado).toBe('oculto');
    expect(com.motivo_inactivacion).toBe('moderacion_reporte');
    expect(com.inactivado_directo).toBe(true);

    // la respuesta sigue VISIBLE (no se tocó el subárbol)
    const resp = await filaComentario(idOf(respuesta));
    expect(resp.estado).toBe('visible');
    expect(resp.motivo_inactivacion).toBeNull();

    // el tema NO se tocó (sigue activo)
    expect((await filaTema(tid)).estado).toBe('activo');
  });
});

describe('reportes — robustez', () => {
  test('no se puede reportar un contenido ya inactivo → 400', async () => {
    const autor = await registerAndLogin();
    const cat = await createCategory(autor.cookie);
    const topic = await createTopic(autor.cookie, { categoria_id: cat.id });
    const tid = idOf(topic);

    await reportarHastaUmbral(tid, cat.id);
    expect((await filaTema(tid)).estado).toBe('inactivo');

    // un nuevo usuario intenta reportar el tema ya caído
    const tardio = await registerAndLogin();
    const res = await reportar(tid, 'spam', tardio.cookie);
    expect(res.status).toBe(400);
  });
});