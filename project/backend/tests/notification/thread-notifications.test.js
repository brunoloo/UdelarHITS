import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createReply, createHomeReply } from '../helpers.js';

const getNotifs = (cookie) => request(app).get('/api/notifications').set('Cookie', cookie).then(r => r.body.data);
const deTipo = async (cookie, tipo) => (await getNotifs(cookie)).filter(n => n.tipo === tipo);
const responder = (cookie, padreId, over = {}) =>
  createReply(cookie, { comentario_padre_id: padreId, ...over });

describe('Notificación: respuesta en un hilo en el que participaste (respuesta_hilo)', () => {
  test('una respuesta anidada avisa al autor del comentario raíz, con link a la respuesta', async () => {
    const raizAutor = await registerAndLogin();
    const b = await registerAndLogin();
    const c = await registerAndLogin();
    const raiz = await createHomeReply(raizAutor.cookie);
    const r1 = await responder(b.cookie, raiz.contenido_id);
    const r2 = await responder(c.cookie, r1.contenido_id);

    const hilo = await deTipo(raizAutor.cookie, 'respuesta_hilo');
    expect(hilo).toHaveLength(1);
    expect(hilo[0].mensaje).toBe(`${c.user.nickname} respondió en un hilo en el que participaste`);
    expect(hilo[0].url).toBe(`/comment/${r2.contenido_id}`);

    // El autor del padre recibe la de siempre, no las dos.
    expect(await deTipo(b.cookie, 'respuesta_comentario')).toHaveLength(1);
    expect(await deTipo(b.cookie, 'respuesta_hilo')).toHaveLength(0);
  });

  test('una respuesta directa al comentario raíz no duplica el aviso', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const raiz = await createHomeReply(a.cookie);
    await responder(b.cookie, raiz.contenido_id);

    expect(await deTipo(a.cookie, 'respuesta_comentario')).toHaveLength(1);
    expect(await deTipo(a.cookie, 'respuesta_hilo')).toHaveLength(0);
  });

  test('quien responde nunca se avisa a sí mismo, aunque haya escrito más arriba', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const raiz = await createHomeReply(a.cookie);
    const r1 = await responder(b.cookie, raiz.contenido_id);
    await responder(a.cookie, r1.contenido_id);

    expect(await deTipo(a.cookie, 'respuesta_hilo')).toHaveLength(0);
  });

  test('un participante que aparece varias veces en la cadena recibe un solo aviso', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const c = await registerAndLogin();
    const raiz = await createHomeReply(a.cookie);
    const r1 = await responder(b.cookie, raiz.contenido_id);
    const r2 = await responder(a.cookie, r1.contenido_id);
    const r3 = await responder(b.cookie, r2.contenido_id);
    await responder(c.cookie, r3.contenido_id);

    // c responde a b: a escribió dos veces más arriba y recibe un único aviso por esta respuesta.
    const hilo = await deTipo(a.cookie, 'respuesta_hilo');
    expect(hilo.filter(n => n.actor_nickname === c.user.nickname)).toHaveLength(1);
  });

  test('no avisa a través de un bloqueo', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const c = await registerAndLogin();
    const raiz = await createHomeReply(a.cookie);
    const r1 = await responder(b.cookie, raiz.contenido_id);
    await request(app).post(`/api/users/${c.user.nickname}/block`).set('Cookie', a.cookie);
    await responder(c.cookie, r1.contenido_id);

    expect(await deTipo(a.cookie, 'respuesta_hilo')).toHaveLength(0);
  });

  test('no avisa al autor de un comentario que quedó oculto', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const c = await registerAndLogin();
    const raiz = await createHomeReply(a.cookie);
    const r1 = await responder(b.cookie, raiz.contenido_id);
    // Con respuestas, el borrado del autor deja el comentario oculto.
    await request(app).delete(`/api/replies/delete/${raiz.contenido_id}`).set('Cookie', a.cookie);
    await responder(c.cookie, r1.contenido_id);

    expect(await deTipo(a.cookie, 'respuesta_hilo')).toHaveLength(0);
  });

  test('una mención a alguien ya avisado por el hilo no genera un segundo aviso', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const c = await registerAndLogin();
    const raiz = await createHomeReply(a.cookie);
    const r1 = await responder(b.cookie, raiz.contenido_id);
    await responder(c.cookie, r1.contenido_id, { cuerpo: `de acuerdo con @${a.user.nickname}` });

    expect(await deTipo(a.cookie, 'respuesta_hilo')).toHaveLength(1);
    expect(await deTipo(a.cookie, 'mencion_comentario')).toHaveLength(0);
  });
});
