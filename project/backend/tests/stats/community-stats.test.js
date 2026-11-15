import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createCategory, createTopic, createReply, createHomeReply } from '../helpers.js';

const stats = () => request(app).get('/api/stats/community').then(r => r.body.data);

describe('GET /stats/community', () => {
  test('es público y arranca en cero', async () => {
    const res = await request(app).get('/api/stats/community');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ miembros: 0, categorias: 0, temas: 0, comentarios: 0 });
  });

  test('cuenta miembros activos, categorías, temas y todos los comentarios visibles', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const tema = await createTopic(a.cookie, { categoria_id: cat.id });
    const home = await createHomeReply(a.cookie);
    await createReply(b.cookie, { comentario_padre_id: home.contenido_id });
    await createReply(b.cookie, { categoria_id: cat.id });
    await createReply(b.cookie, { tema_id: tema.id ?? tema.contenido_id });

    expect(await stats()).toEqual({ miembros: 2, categorias: 1, temas: 1, comentarios: 4 });
  });

  test('no cuenta comentarios ocultos ni cuentas que no están activas', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const padre = await createHomeReply(a.cookie);
    await createReply(b.cookie, { comentario_padre_id: padre.contenido_id });
    // Con respuestas, el borrado del autor deja el comentario oculto.
    await request(app).delete(`/api/replies/delete/${padre.contenido_id}`).set('Cookie', a.cookie);
    await pool.query(`UPDATE usuario SET estado = 'ban' WHERE id = $1`, [b.user.id]);

    expect(await stats()).toMatchObject({ miembros: 1, comentarios: 1 });
  });

  test('no cuenta categorías inactivas ni sus temas', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    await createTopic(a.cookie, { categoria_id: cat.id });
    await createReply(b.cookie, { categoria_id: cat.id });
    // Con contenido ajeno el borrado es lógico: la categoría queda inactiva.
    await request(app).delete(`/api/categories/${cat.id}/delete`).set('Cookie', a.cookie);

    expect(await stats()).toMatchObject({ categorias: 0, temas: 0 });
  });
});
