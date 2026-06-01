import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createCategory, createReply } from '../helpers.js';

const idOf = (x) => x.id ?? x.contenido_id;

describe('data-leak: título de categoría inactiva en comentarios del perfil', () => {
  test('al desactivar una categoría, su título NO debe viajar en los comentarios del usuario', async () => {
    const autor = await registerAndLogin();   // crea la categoría
    const otro = await registerAndLogin();      // comenta en ella

    const TITULO_SECRETO = 'CatSecreta_' + Math.random().toString(36).slice(2, 8);
    const cat = await createCategory(autor.cookie, { titulo: TITULO_SECRETO });

    // 'otro' comenta directo en la categoría → al borrarla queda inactiva
    const reply = await createReply(otro.cookie, { categoria_id: cat.id });

    // el autor borra la categoría → soft delete (queda inactiva)
    const delRes = await request(app)
      .delete(`/api/categories/${cat.id}/delete`)
      .set('Cookie', autor.cookie);
    expect(delRes.status).toBe(200);
    expect(delRes.body.data.action).toBe('deactivated');

    // los comentarios de 'otro' (perfil)
    const res = await request(app)
      .get(`/api/replies/user/${otro.user.id}`)
      .set('Cookie', otro.cookie);
    expect(res.status).toBe(200);

    const comentario = res.body.data.find(c => idOf(c) === idOf(reply));
    expect(comentario).toBeDefined();
    expect(comentario.categoria_estado).toBe('inactiva');   // flag correcto
    expect(comentario.destino_titulo).toBeNull();            // título NO viaja
  });
});