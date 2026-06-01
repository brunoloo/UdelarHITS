import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createTopic, createReply } from '../helpers.js';

const idOf = (x) => x.id ?? x.contenido_id;

describe('data-leak: título de tema inactivo en el perfil', () => {
  test('al desactivar un tema, su título NO debe viajar en los comentarios del usuario', async () => {
    const autor = await registerAndLogin();   // crea el tema
    const otro = await registerAndLogin();     // comenta (para que el tema quede inactivo, no borrado)

    const TITULO_SECRETO = 'TituloQueNoDebeFiltrarse_' + Math.random().toString(36).slice(2, 8);
    const topic = await createTopic(autor.cookie, { titulo: TITULO_SECRETO });

    // 'otro' comenta en el tema → al borrarlo, el tema queda inactivo (tiene contenido ajeno)
    const reply = await createReply(otro.cookie, { tema_id: idOf(topic) });

    // el autor borra el tema → soft delete (queda inactivo, título renombrado con _deleted_)
    const delRes = await request(app)
      .delete(`/api/topics/${idOf(topic)}/delete`)
      .set('Cookie', autor.cookie);
    expect(delRes.status).toBe(200);
    expect(delRes.body.data.action).toBe('deactivated'); // confirma soft delete, no hard

    // pido los comentarios de 'otro' (lo que alimenta su perfil)
    const res = await request(app)
      .get(`/api/replies/user/${otro.user.id}`)
      .set('Cookie', otro.cookie);
    expect(res.status).toBe(200);

    const comentario = res.body.data.find(c => idOf(c) === idOf(reply));
    expect(comentario).toBeDefined();

    // EL CORAZÓN DEL TEST: el título del tema inactivo no debe estar en la respuesta,
    // ni limpio ni con el sufijo _deleted_
    expect(comentario.tema_estado).toBe('inactivo');           // el flag sí debe venir
    // el título no debe viajar: viene null cuando el tema está inactivo
    expect(comentario.destino_titulo).toBeNull();
  });
});