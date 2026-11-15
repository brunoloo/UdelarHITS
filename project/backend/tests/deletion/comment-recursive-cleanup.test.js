import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createTopic, createCategory } from '../helpers.js';

const idOf = (x) => x.id ?? x.contenido_id;

const comentarioExiste = async (id) => {
  const { rows } = await pool.query('SELECT 1 FROM comentario WHERE contenido_id = $1', [id]);
  return rows.length > 0;
};
const estadoComentario = async (id) => {
  const { rows } = await pool.query('SELECT estado FROM comentario WHERE contenido_id = $1', [id]);
  return rows[0]?.estado ?? null;
};

// Crea un comentario con body explícito (para controlar la cadena de respuestas)
async function comentar(cookie, body) {
  const res = await request(app).post('/api/replies/create').set('Cookie', cookie).send(body);
  if (res.status >= 400) throw new Error(`comentar falló (${res.status}): ${JSON.stringify(res.body)}`);
  return res.body.data;
}
const borrar = (id, cookie) =>
  request(app).delete(`/api/replies/delete/${id}`).set('Cookie', cookie);

describe('limpieza recursiva de comentarios ocultos', () => {
  test('borrar la hoja de una cadena de ocultos limpia toda la rama hacia arriba', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const topic = await createTopic(a.cookie);
    const tid = idOf(topic);

    // abuelo (de A) → padre (de B, responde al abuelo) → hijo (de A, responde al padre)
    const abuelo = await comentar(a.cookie, { cuerpo: 'abuelo', tema_id: tid });
    const padre  = await comentar(b.cookie, { cuerpo: 'padre',  tema_id: tid, comentario_padre_id: idOf(abuelo) });
    const hijo   = await comentar(a.cookie, { cuerpo: 'hijo',   tema_id: tid, comentario_padre_id: idOf(padre) });

    // borrar abuelo → tiene respuesta (padre) → oculto
    let res = await borrar(idOf(abuelo), a.cookie);
    expect(res.body.data.action).toBe('hidden');
    expect(await estadoComentario(idOf(abuelo))).toBe('oculto');

    // borrar padre → tiene respuesta (hijo) → oculto
    res = await borrar(idOf(padre), b.cookie);
    expect(res.body.data.action).toBe('hidden');
    expect(await estadoComentario(idOf(padre))).toBe('oculto');

    // borrar hijo → hoja → hard delete + dispara recursión hacia arriba
    res = await borrar(idOf(hijo), a.cookie);
    expect(res.body.data.action).toBe('deleted');

    // toda la rama muerta se limpió: ninguno de los tres existe
    expect(await comentarioExiste(idOf(hijo))).toBe(false);
    expect(await comentarioExiste(idOf(padre))).toBe(false);
    expect(await comentarioExiste(idOf(abuelo))).toBe(false);
  });
});

describe('cascada hacia el contenedor: tema/categoría inactivo que se vacía', () => {
  const temaExiste = async (id) => {
    const { rows } = await pool.query('SELECT 1 FROM tema WHERE contenido_id = $1', [id]);
    return rows.length > 0;
  };
  const categoriaExiste = async (id) => {
    const { rows } = await pool.query('SELECT 1 FROM categoria WHERE id = $1', [id]);
    return rows.length > 0;
  };

  test('borrar el último comentario de un TEMA inactivo borra el tema físicamente', async () => {
    const a = await registerAndLogin();   // dueño del tema
    const b = await registerAndLogin();    // autor del único comentario
    const topic = await createTopic(a.cookie);
    const tid = idOf(topic);

    const comentario = await comentar(b.cookie, { cuerpo: 'único comentario', tema_id: tid });

    // A borra el tema → soft (queda inactivo, tiene el comentario de B)
    const delTopic = await request(app).delete(`/api/topics/${tid}/delete`).set('Cookie', a.cookie);
    expect(delTopic.body.data.action).toBe('deactivated');
    expect(await temaExiste(tid)).toBe(true);

    // B borra su comentario → hard del comentario + tema inactivo vacío → se borra
    const res = await borrar(idOf(comentario), b.cookie);
    expect(res.body.data.action).toBe('deleted');
    expect(await temaExiste(tid)).toBe(false);
  });

  test('borrar el último comentario de un TEMA inactivo borra el tema físicamente', async () => {
    const a = await registerAndLogin();   // dueño del tema
    const b = await registerAndLogin();    // autor del único comentario
    const topic = await createTopic(a.cookie);
    const tid = idOf(topic);

    const comentario = await comentar(b.cookie, { cuerpo: 'único comentario', tema_id: tid });

    // A borra el tema → soft (queda inactivo, tiene el comentario de B)
    const delTopic = await request(app).delete(`/api/topics/${tid}/delete`).set('Cookie', a.cookie);
    expect(delTopic.body.data.action).toBe('deactivated');
    expect(await temaExiste(tid)).toBe(true);

    // B borra su comentario → hard del comentario + tema inactivo vacío → se borra
    const res = await borrar(idOf(comentario), b.cookie);
    expect(res.body.data.action).toBe('deleted');
    expect(await temaExiste(tid)).toBe(false);
  });
});