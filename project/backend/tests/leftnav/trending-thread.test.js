import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createCategory, createTopic, createReply, createHomeReply } from '../helpers.js';

const trending = (cookie = null) => {
  const req = request(app).get('/api/replies/trending');
  return cookie ? req.set('Cookie', cookie) : req;
};

const responder = (cookie, padreId, cuerpo = 'respuesta') =>
  createReply(cookie, { comentario_padre_id: padreId, cuerpo });

const envejecer = (contenidoId, dias) => pool.query(
  `UPDATE contenido SET fecha_creacion = NOW() - MAKE_INTERVAL(days => $2) WHERE id = $1`,
  [contenidoId, dias]
);

describe('GET /replies/trending', () => {
  test('es público; sin hilos con respuestas devuelve null', async () => {
    const a = await registerAndLogin();
    await createHomeReply(a.cookie);

    const res = await trending();
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  test('elige el hilo de Home con más respuestas e incluye el preview', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const poco = await createHomeReply(a.cookie, { cuerpo: 'poco' });
    const mucho = await createHomeReply(a.cookie, { cuerpo: 'mucho' });
    await responder(b.cookie, poco.contenido_id);
    await responder(b.cookie, mucho.contenido_id, 'uno');
    await responder(a.cookie, mucho.contenido_id, 'dos');

    const res = await trending();
    expect(Number(res.body.data.id)).toBe(Number(mucho.contenido_id));
    expect(res.body.data.tipo).toBe('home');
    expect(res.body.data.respuestas_recientes).toBe(2);
    expect(res.body.data.respuestas_preview.map(p => p.texto)).toEqual(['dos', 'uno']);
    expect(res.body.ventana_dias).toBe(7);
  });

  test('cuenta las respuestas anidadas del hilo', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const plano = await createHomeReply(a.cookie, { cuerpo: 'plano' });
    const profundo = await createHomeReply(a.cookie, { cuerpo: 'profundo' });
    await responder(b.cookie, plano.contenido_id);
    await responder(b.cookie, plano.contenido_id);
    const r1 = await responder(b.cookie, profundo.contenido_id);
    const r2 = await responder(a.cookie, r1.contenido_id);
    await responder(b.cookie, r2.contenido_id);

    const res = await trending();
    expect(Number(res.body.data.id)).toBe(Number(profundo.contenido_id));
    expect(res.body.data.respuestas_recientes).toBe(3);
  });

  test('un comentario directo de una categoría también califica, con su destino', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const cat = await createCategory(a.cookie, { titulo: 'Con hilo' });
    const raiz = await createReply(a.cookie, { categoria_id: cat.id, cuerpo: 'en categoría' });
    await responder(b.cookie, raiz.contenido_id);

    const res = await trending();
    expect(Number(res.body.data.id)).toBe(Number(raiz.contenido_id));
    expect(res.body.data.tipo).toBe('categoria');
    expect(Number(res.body.data.destino_id)).toBe(Number(cat.id));
    expect(res.body.data.destino_titulo).toBe('Con hilo');
  });

  test('los comentarios de un tema quedan para el tema en tendencia', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const topic = await createTopic(a.cookie);
    const raiz = await createReply(a.cookie, { tema_id: topic.id ?? topic.contenido_id });
    await responder(b.cookie, raiz.contenido_id);

    const res = await trending();
    expect(res.body.data).toBeNull();
  });

  test('sin respuestas recientes amplía la ventana y la informa', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const raiz = await createHomeReply(a.cookie);
    const resp = await responder(b.cookie, raiz.contenido_id);
    await envejecer(resp.contenido_id, 45);

    const res = await trending();
    expect(Number(res.body.data.id)).toBe(Number(raiz.contenido_id));
    expect(res.body.ventana_dias).toBe(90);
  });

  test('un hilo cuyo comentario raíz fue ocultado no aparece', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const raiz = await createHomeReply(a.cookie);
    await responder(b.cookie, raiz.contenido_id);
    // Con respuestas, el borrado del autor oculta el comentario.
    await request(app).delete(`/api/replies/delete/${raiz.contenido_id}`).set('Cookie', a.cookie);

    const res = await trending();
    expect(res.body.data).toBeNull();
  });

  test('no muestra hilos de un autor bloqueado por quien mira', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const c = await registerAndLogin();
    const raiz = await createHomeReply(a.cookie);
    await responder(b.cookie, raiz.contenido_id);
    await request(app).post(`/api/users/${a.user.nickname}/block`).set('Cookie', c.cookie);

    const bloqueador = await trending(c.cookie);
    expect(bloqueador.body.data).toBeNull();

    const invitado = await trending();
    expect(Number(invitado.body.data.id)).toBe(Number(raiz.contenido_id));
  });
});
