import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createCategory, createTopic } from '../helpers.js';

const idOf = (x) => x.id ?? x.contenido_id;

const contadorDe = async (categoriaId) => {
  const { rows } = await pool.query(
    'SELECT contador_temas FROM categoria WHERE id = $1', [categoriaId]
  );
  return rows[0]?.contador_temas ?? null;
};

const deleteTopic = (id, cookie) =>
  request(app).delete(`/api/topics/${id}/delete`).set('Cookie', cookie);

describe('contador_temas de la categoría', () => {
  test('arranca en 0, sube al crear temas y baja al borrar', async () => {
    const autor = await registerAndLogin();
    const cat = await createCategory(autor.cookie);

    expect(await contadorDe(cat.id)).toBe(0);

    const t1 = await createTopic(autor.cookie, { categoria_id: cat.id });
    expect(await contadorDe(cat.id)).toBe(1);

    const t2 = await createTopic(autor.cookie, { categoria_id: cat.id });
    expect(await contadorDe(cat.id)).toBe(2);

    // borrar un tema (sin comentarios → hard delete) baja el contador a 1
    const res = await deleteTopic(idOf(t1), autor.cookie);
    expect(res.status).toBe(200);
    expect(await contadorDe(cat.id)).toBe(1);
  });

  test('el decremento ocurre tanto en hard como en soft delete', async () => {
    const autor = await registerAndLogin();
    const otro = await registerAndLogin();
    const cat = await createCategory(autor.cookie);

    const t1 = await createTopic(autor.cookie, { categoria_id: cat.id });
    const t2 = await createTopic(autor.cookie, { categoria_id: cat.id });
    expect(await contadorDe(cat.id)).toBe(2);

    // t2 recibe un comentario → su borrado será soft, pero igual debe decrementar
    await request(app).post('/api/replies/create')
      .set('Cookie', otro.cookie)
      .send({ cuerpo: 'comentario', tema_id: idOf(t2) });

    const res = await deleteTopic(idOf(t2), autor.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.action).toBe('deactivated');  // soft delete
    expect(await contadorDe(cat.id)).toBe(1);            // pero el contador igual bajó
  });
});