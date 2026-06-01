import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createCategory, createTopic } from '../helpers.js';

const popular = (qs = '') => request(app).get(`/api/categories/popular${qs}`);

describe('GET /categories/popular', () => {
  test('es público → 200 y array', async () => {
    const res = await popular();
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('solo aparecen categorías CON actividad', async () => {
    const u = await registerAndLogin();
    const conActividad = await createCategory(u.cookie, { titulo: 'Con actividad' });
    const vacia = await createCategory(u.cookie, { titulo: 'Vacía' });
    // darle un tema a la primera
    await createTopic(u.cookie, { categoria_id: conActividad.id });

    const res = await popular();
    const ids = res.body.data.map(c => c.id);
    expect(ids).toContain(conActividad.id);    // tiene actividad → figura
    expect(ids).not.toContain(vacia.id);        // sin actividad → no figura
  });

  test('ordena por actividad descendente', async () => {
    const u = await registerAndLogin();
    const poca = await createCategory(u.cookie, { titulo: 'Poca actividad' });
    const mucha = await createCategory(u.cookie, { titulo: 'Mucha actividad' });

    // 'poca' recibe 1 tema, 'mucha' recibe 3
    await createTopic(u.cookie, { categoria_id: poca.id });
    await createTopic(u.cookie, { categoria_id: mucha.id });
    await createTopic(u.cookie, { categoria_id: mucha.id });
    await createTopic(u.cookie, { categoria_id: mucha.id });

    const res = await popular();
    const ids = res.body.data.map(c => c.id);
    // 'mucha' debe aparecer antes que 'poca'
    expect(ids.indexOf(mucha.id)).toBeLessThan(ids.indexOf(poca.id));
  });

  test('una categoría inactiva NO aparece aunque tenga actividad', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const cat = await createCategory(a.cookie, { titulo: 'Será inactiva' });
    await createTopic(a.cookie, { categoria_id: cat.id });
    // b comenta para que el borrado sea soft → categoría inactiva
    await request(app).post('/api/replies/create')
      .set('Cookie', b.cookie).send({ cuerpo: 'c', categoria_id: cat.id });
    await request(app).delete(`/api/categories/${cat.id}/delete`).set('Cookie', a.cookie);

    const res = await popular();
    const ids = res.body.data.map(c => c.id);
    expect(ids).not.toContain(cat.id);
  });

  test('respeta el límite ?limit=', async () => {
    const u = await registerAndLogin();
    for (let i = 0; i < 4; i++) {
      const c = await createCategory(u.cookie, { titulo: `Cat ${i}` });
      await createTopic(u.cookie, { categoria_id: c.id });
    }
    const res = await popular('?limit=2');
    expect(res.body.data.length).toBeLessThanOrEqual(2);
  });
});

describe('GET /categories/popular — ventana de tiempo', () => {
  // inserta un tema directo en la BD con fecha de creación arbitraria
  async function insertarTemaConFecha(autorId, categoriaId, diasAtras) {
    const { rows } = await pool.query(
      `INSERT INTO contenido (autor_id, cuerpo, fecha_creacion)
       VALUES ($1, $2, NOW() - MAKE_INTERVAL(days => $3))
       RETURNING id`,
      [autorId, 'cuerpo viejo', diasAtras]
    );
    const contenidoId = rows[0].id;
    await pool.query(
      `INSERT INTO tema (contenido_id, categoria_id, titulo) VALUES ($1, $2, $3)`,
      [contenidoId, categoriaId, 'Tema viejo ' + Math.random().toString(36).slice(2, 6)]
    );
    return contenidoId;
  }

  test('actividad de hace 10 días NO cuenta con days=7, pero SÍ con days=30', async () => {
    const u = await registerAndLogin();
    const cat = await createCategory(u.cookie, { titulo: 'Actividad vieja' });
    // su única actividad es un tema de hace 10 días
    await insertarTemaConFecha(u.user.id, cat.id, 10);

    // ventana de 7 días: el tema (10 días) queda fuera → la categoría no figura
    const res7 = await popular('?days=7');
    expect(res7.body.data.map(c => c.id)).not.toContain(cat.id);

    // ventana de 30 días: el tema (10 días) entra → la categoría sí figura
    const res30 = await popular('?days=30');
    expect(res30.body.data.map(c => c.id)).toContain(cat.id);
  });
});