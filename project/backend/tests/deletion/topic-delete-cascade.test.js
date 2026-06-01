import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createTopic, createReply } from '../helpers.js';

const idOf = (x) => x.id ?? x.contenido_id;

// helpers de verificación directa contra la BD
const temaExiste = async (id) => {
  const { rows } = await pool.query('SELECT 1 FROM tema WHERE contenido_id = $1', [id]);
  return rows.length > 0;
};
const contenidoExiste = async (id) => {
  const { rows } = await pool.query('SELECT 1 FROM contenido WHERE id = $1', [id]);
  return rows.length > 0;
};
const estadoDelTema = async (id) => {
  const { rows } = await pool.query('SELECT estado FROM tema WHERE contenido_id = $1', [id]);
  return rows[0]?.estado ?? null;
};

const deleteTopic = (id, cookie) =>
  request(app).delete(`/api/topics/${id}/delete`).set('Cookie', cookie);

describe('eliminación de tema — hard vs soft', () => {
  test('tema SIN comentarios → hard delete (desaparece de la BD)', async () => {
    const autor = await registerAndLogin();
    const topic = await createTopic(autor.cookie);
    const tid = idOf(topic);

    // precondición: existe antes de borrar
    expect(await temaExiste(tid)).toBe(true);

    const res = await deleteTopic(tid, autor.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('deleted');

    // la fila desapareció de tema Y de contenido
    expect(await temaExiste(tid)).toBe(false);
    expect(await contenidoExiste(tid)).toBe(false);
  });

  test('tema CON comentarios → soft delete (queda inactivo, no se borra)', async () => {
    const autor = await registerAndLogin();
    const otro = await registerAndLogin();
    const topic = await createTopic(autor.cookie);
    const tid = idOf(topic);

    // un comentario de otro usuario lo vuelve "con contenido"
    await createReply(otro.cookie, { tema_id: tid });

    const res = await deleteTopic(tid, autor.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('deactivated');

    // la fila SIGUE existiendo, pero inactiva
    expect(await temaExiste(tid)).toBe(true);
    expect(await estadoDelTema(tid)).toBe('inactivo');
  });
});