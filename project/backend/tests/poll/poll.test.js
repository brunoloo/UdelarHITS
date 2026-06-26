import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createCategory } from '../helpers.js';

// Crea un comentario con encuesta vía multipart (como el front).
const crearConEncuesta = (cookie, catId, encuesta, cuerpo = '') => {
  let req = request(app).post('/api/replies/create').set('Cookie', cookie)
    .field('categoria_id', String(catId))
    .field('encuesta', JSON.stringify(encuesta));
  if (cuerpo) req = req.field('cuerpo', cuerpo);
  return req;
};

const encuestaOk = { opciones: ['Rojo', 'Azul'], duracion_segundos: 3600 };

describe('Encuestas en comentarios', () => {
  test('crea un comentario con encuesta y la devuelve', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const res = await crearConEncuesta(a.cookie, cat.id, { opciones: ['Rojo', 'Azul', 'Verde'], duracion_segundos: 3600 }, 'Mejor color?');
    expect(res.status).toBe(201);
    expect(res.body.data.encuesta).toBeTruthy();
    expect(res.body.data.encuesta.opciones).toHaveLength(3);
    expect(res.body.data.encuesta.total_votos).toBe(0);
    expect(res.body.data.encuesta.mi_voto).toBeNull();
    expect(new Date(res.body.data.encuesta.fecha_cierre).getTime()).toBeGreaterThan(Date.now());
  });

  test('permite publicar solo con encuesta (sin texto ni adjuntos)', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const res = await crearConEncuesta(a.cookie, cat.id, encuestaOk);
    expect(res.status).toBe(201);
    expect(res.body.data.encuesta.opciones).toHaveLength(2);
  });

  test('menos de 2 opciones → 400', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const res = await crearConEncuesta(a.cookie, cat.id, { opciones: ['Una'], duracion_segundos: 3600 });
    expect(res.status).toBe(400);
  });

  test('más de 5 opciones → 400', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const res = await crearConEncuesta(a.cookie, cat.id, { opciones: ['1', '2', '3', '4', '5', '6'], duracion_segundos: 3600 });
    expect(res.status).toBe(400);
  });

  test('duración fuera de rango → 400', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const corta = await crearConEncuesta(a.cookie, cat.id, { opciones: ['A', 'B'], duracion_segundos: 30 });
    expect(corta.status).toBe(400);
    const larga = await crearConEncuesta(a.cookie, cat.id, { opciones: ['A', 'B'], duracion_segundos: 8 * 24 * 3600 });
    expect(larga.status).toBe(400);
  });

  test('votar revela resultados y cuenta el voto', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const create = await crearConEncuesta(a.cookie, cat.id, encuestaOk);
    const enc = create.body.data.encuesta;
    const opcion = enc.opciones[0];

    const res = await request(app).post(`/api/polls/${enc.id}/vote`)
      .set('Cookie', b.cookie).send({ opcion_id: opcion.id });
    expect(res.status).toBe(200);
    expect(res.body.data.mi_voto).toBe(opcion.id);
    expect(res.body.data.total_votos).toBe(1);
    const votada = res.body.data.opciones.find(o => o.id === opcion.id);
    expect(Number(votada.votos)).toBe(1);
  });

  test('votar dos veces → 400', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const create = await crearConEncuesta(a.cookie, cat.id, encuestaOk);
    const enc = create.body.data.encuesta;
    await request(app).post(`/api/polls/${enc.id}/vote`).set('Cookie', a.cookie).send({ opcion_id: enc.opciones[0].id });
    const dup = await request(app).post(`/api/polls/${enc.id}/vote`).set('Cookie', a.cookie).send({ opcion_id: enc.opciones[1].id });
    expect(dup.status).toBe(400);
  });

  test('votar una opción de otra encuesta → 400', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const e1 = (await crearConEncuesta(a.cookie, cat.id, encuestaOk)).body.data.encuesta;
    const e2 = (await crearConEncuesta(a.cookie, cat.id, encuestaOk)).body.data.encuesta;
    const res = await request(app).post(`/api/polls/${e1.id}/vote`)
      .set('Cookie', a.cookie).send({ opcion_id: e2.opciones[0].id });
    expect(res.status).toBe(400);
  });

  test('votar una encuesta finalizada → 400', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const enc = (await crearConEncuesta(a.cookie, cat.id, encuestaOk)).body.data.encuesta;
    // Forzar el cierre en la BD.
    await pool.query('UPDATE encuesta SET fecha_cierre = NOW() - INTERVAL \'1 minute\' WHERE id = $1', [enc.id]);
    const res = await request(app).post(`/api/polls/${enc.id}/vote`)
      .set('Cookie', a.cookie).send({ opcion_id: enc.opciones[0].id });
    expect(res.status).toBe(400);
  });

  test('la encuesta aparece en la lista de comentarios de la categoría', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    await crearConEncuesta(a.cookie, cat.id, encuestaOk, 'con encuesta');
    const list = await request(app).get(`/api/replies/category/${cat.id}`).set('Cookie', a.cookie).then(r => r.body.data);
    expect(list[0].encuesta).toBeTruthy();
    expect(list[0].encuesta.opciones).toHaveLength(2);
  });
});
