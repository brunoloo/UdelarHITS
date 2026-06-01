import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createCategory, createTopic, createReply } from '../helpers.js';

const idOf = (x) => x.id ?? x.contenido_id;

describe('data-leak: título de categoría inactiva en la pestaña Temas del perfil', () => {
  test('un tema activo en categoría inactiva NO debe arrastrar el título de la categoría', async () => {
    const autor = await registerAndLogin();   // dueño de la categoría y del tema
    const otro = await registerAndLogin();      // comenta para forzar soft-delete de la categoría

    const TITULO_SECRETO = 'CatSecretaTopics_' + Math.random().toString(36).slice(2, 8);
    const cat = await createCategory(autor.cookie, { titulo: TITULO_SECRETO });

    // el autor crea un tema dentro de la categoría (queda activo)
    const topic = await createTopic(autor.cookie, { categoria_id: cat.id });

    // 'otro' comenta directo en la categoría → al borrarla, queda inactiva (tiene contenido)
    await createReply(otro.cookie, { categoria_id: cat.id });

    // el autor desactiva la categoría → inactiva, PERO el tema sigue activo
    const delRes = await request(app)
      .delete(`/api/categories/${cat.id}/delete`)
      .set('Cookie', autor.cookie);
    expect(delRes.status).toBe(200);
    expect(delRes.body.data.action).toBe('deactivated');

    // pido los temas del autor (pestaña Temas del perfil)
    const res = await request(app)
      .get(`/api/topics/user/${autor.user.id}`)
      .set('Cookie', autor.cookie);
    expect(res.status).toBe(200);

    const temaEnLista = res.body.data.find(t => idOf(t) === idOf(topic));
    expect(temaEnLista).toBeDefined();                          // el tema activo SÍ aparece
    expect(temaEnLista.categoria_estado).toBe('inactiva');      // flag correcto
    expect(temaEnLista.categoria_titulo).toBeNull();            // título de la cat NO viaja
  });
});