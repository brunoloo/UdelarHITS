import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createTopic } from '../helpers.js';

const idOf = (x) => x.id ?? x.contenido_id;

const comentarioExiste = async (id) => {
  const { rows } = await pool.query('SELECT 1 FROM comentario WHERE contenido_id = $1', [id]);
  return rows.length > 0;
};
const estadoComentario = async (id) => {
  const { rows } = await pool.query('SELECT estado FROM comentario WHERE contenido_id = $1', [id]);
  return rows[0]?.estado ?? null;
};

async function comentar(cookie, body) {
  const res = await request(app).post('/api/replies/create').set('Cookie', cookie).send(body);
  if (res.status >= 400) throw new Error(`comentar falló (${res.status}): ${JSON.stringify(res.body)}`);
  return res.body.data;
}
const borrar = (id, cookie) =>
  request(app).delete(`/api/replies/delete/${id}`).set('Cookie', cookie);

describe('eliminación de comentario — hard vs soft', () => {
  test('comentario SIN respuestas → hard delete (desaparece de la BD)', async () => {
    const u = await registerAndLogin();
    const topic = await createTopic(u.cookie);
    const c = await comentar(u.cookie, { cuerpo: 'solo', tema_id: idOf(topic) });
    const cid = idOf(c);

    expect(await comentarioExiste(cid)).toBe(true);

    const res = await borrar(cid, u.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('deleted');

    expect(await comentarioExiste(cid)).toBe(false);
  });

  test('comentario CON respuestas → soft delete (queda oculto)', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const topic = await createTopic(a.cookie);
    const padre = await comentar(a.cookie, { cuerpo: 'padre', tema_id: idOf(topic) });
    await comentar(b.cookie, { cuerpo: 'respuesta', tema_id: idOf(topic), comentario_padre_id: idOf(padre) });

    const res = await borrar(idOf(padre), a.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('hidden');

    // sigue existiendo, pero oculto
    expect(await comentarioExiste(idOf(padre))).toBe(true);
    expect(await estadoComentario(idOf(padre))).toBe('oculto');
  });

  test('el hilo sigue navegable: la respuesta cuelga del comentario oculto', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const topic = await createTopic(a.cookie);
    const padre = await comentar(a.cookie, { cuerpo: 'padre', tema_id: idOf(topic) });
    const hijo = await comentar(b.cookie, { cuerpo: 'hijo', tema_id: idOf(topic), comentario_padre_id: idOf(padre) });

    await borrar(idOf(padre), a.cookie);  // padre queda oculto

    // pedir las respuestas del comentario oculto: el hijo sigue ahí
    const res = await request(app).get(`/api/replies/${idOf(padre)}/replies`);
    expect(res.status).toBe(200);
    const ids = res.body.data.map(r => idOf(r));
    expect(ids).toContain(idOf(hijo));
  });
});