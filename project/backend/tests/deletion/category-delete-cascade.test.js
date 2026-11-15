import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createCategory, createTopic, createReply } from '../helpers.js';

const idOf = (x) => x.id ?? x.contenido_id;

const categoriaExiste = async (id) => {
  const { rows } = await pool.query('SELECT 1 FROM categoria WHERE id = $1', [id]);
  return rows.length > 0;
};
const estadoCategoria = async (id) => {
  const { rows } = await pool.query('SELECT estado FROM categoria WHERE id = $1', [id]);
  return rows[0]?.estado ?? null;
};

const delCat = (id, cookie) =>
  request(app).delete(`/api/categories/${id}/delete`).set('Cookie', cookie);

describe('eliminación de categoría — hard vs soft', () => {
  test('categoría SIN contenido → hard delete (desaparece de la BD)', async () => {
    const u = await registerAndLogin();
    const cat = await createCategory(u.cookie);
    expect(await categoriaExiste(cat.id)).toBe(true);

    const res = await delCat(cat.id, u.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('deleted');

    expect(await categoriaExiste(cat.id)).toBe(false);
  });

  test('categoría CON un tema → soft delete (queda inactiva)', async () => {
    const u = await registerAndLogin();
    const cat = await createCategory(u.cookie);
    await createTopic(u.cookie, { categoria_id: cat.id });  // le da contenido

    const res = await delCat(cat.id, u.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('deactivated');

    expect(await categoriaExiste(cat.id)).toBe(true);
    expect(await estadoCategoria(cat.id)).toBe('inactiva');
  });

  test('categoría CON un comentario directo → soft delete (queda inactiva)', async () => {
    const u = await registerAndLogin();
    const otro = await registerAndLogin();
    const cat = await createCategory(u.cookie);
    await createReply(otro.cookie, { categoria_id: cat.id });  // comentario directo a la categoría

    const res = await delCat(cat.id, u.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('deactivated');
    expect(await estadoCategoria(cat.id)).toBe('inactiva');
  });
});