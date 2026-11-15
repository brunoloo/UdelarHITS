import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createTopic, createReply } from '../helpers.js';

const idOf = (x) => x.id ?? x.contenido_id;

// El autor borra un comentario con respuestas: queda oculto, no eliminado.
async function hiddenCommentInTopic() {
  const autor = await registerAndLogin();
  const otro = await registerAndLogin();
  const topic = await createTopic(autor.cookie);
  const temaId = idOf(topic);
  const cuerpo = 'TextoOculto_' + Math.random().toString(36).slice(2, 8);
  const padre = await createReply(autor.cookie, { tema_id: temaId, cuerpo });
  const padreId = idOf(padre);
  await createReply(otro.cookie, { tema_id: temaId, comentario_padre_id: padreId });

  const edit = await request(app)
    .patch(`/api/replies/update/${padreId}`).set('Cookie', autor.cookie)
    .send({ cuerpo: cuerpo + '_editado' });
  expect(edit.status).toBe(200);

  const del = await request(app)
    .delete(`/api/replies/delete/${padreId}`).set('Cookie', autor.cookie);
  expect(del.body.data.action).toBe('hidden');

  return { autor, otro, temaId, padreId, cuerpo };
}

const expectRedacted = (c) => {
  expect(c.estado).toBe('oculto');
  expect(c.cuerpo).toBeNull();
  expect(c.autor_id).toBeNull();
  if ('autor_nickname' in c) expect(c.autor_nickname).toBeNull();
  if ('adjuntos' in c) expect(c.adjuntos).toEqual([]);
};

describe('comentario oculto: el contenido no sale del servidor', () => {
  test('detalle por id', async () => {
    const { padreId, cuerpo } = await hiddenCommentInTopic();
    const res = await request(app).get(`/api/replies/${padreId}`);
    expect(res.status).toBe(200);
    expectRedacted(res.body.data);
    expect(JSON.stringify(res.body)).not.toContain(cuerpo);
  });

  test('listado del tema', async () => {
    const { temaId, padreId, cuerpo } = await hiddenCommentInTopic();
    const res = await request(app).get(`/api/replies/topic/${temaId}`);
    expect(res.status).toBe(200);
    const oculto = res.body.data.find((c) => Number(c.id) === Number(padreId));
    expectRedacted(oculto);
    expect(JSON.stringify(res.body)).not.toContain(cuerpo);
  });

  test('cadena de contexto de una respuesta', async () => {
    const { temaId, padreId, otro, cuerpo } = await hiddenCommentInTopic();
    const hija = await createReply(otro.cookie, { tema_id: temaId, comentario_padre_id: padreId });
    const res = await request(app).get(`/api/replies/${idOf(hija)}/context`);
    expect(res.status).toBe(200);
    const oculto = res.body.data.find((c) => Number(c.id) === Number(padreId));
    expectRedacted(oculto);
    expect(JSON.stringify(res.body)).not.toContain(cuerpo);
  });

  test('historial de edición vacío', async () => {
    const { padreId } = await hiddenCommentInTopic();
    const res = await request(app).get(`/api/replies/${padreId}/history`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('el autor no puede editarlo', async () => {
    const { autor, padreId } = await hiddenCommentInTopic();
    const res = await request(app)
      .patch(`/api/replies/update/${padreId}`).set('Cookie', autor.cookie)
      .send({ cuerpo: 'nuevo texto' });
    expect(res.status).toBe(400);
  });

  test('listado de comentarios del autor para un tercero', async () => {
    const { autor, otro, padreId, cuerpo } = await hiddenCommentInTopic();
    const res = await request(app)
      .get(`/api/replies/user/${autor.user.id}`).set('Cookie', otro.cookie);
    expect(res.status).toBe(200);
    const oculto = res.body.data.find((c) => Number(c.id) === Number(padreId));
    if (oculto) expectRedacted(oculto);
    expect(JSON.stringify(res.body)).not.toContain(cuerpo);
  });
});

describe('historial de edición de contenido inactivo', () => {
  test('tema inactivo: historial vacío', async () => {
    const autor = await registerAndLogin();
    const otro = await registerAndLogin();
    const topic = await createTopic(autor.cookie, { cuerpo: 'VersionOriginal' });
    const temaId = idOf(topic);

    const edit = await request(app)
      .patch(`/api/topics/${temaId}`).set('Cookie', autor.cookie)
      .send({ cuerpo: 'VersionEditada' });
    expect(edit.status).toBe(200);

    await createReply(otro.cookie, { tema_id: temaId });
    const del = await request(app)
      .delete(`/api/topics/${temaId}/delete`).set('Cookie', autor.cookie);
    expect(del.body.data.action).toBe('deactivated');

    const res = await request(app).get(`/api/topics/${temaId}/history`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('adjuntos en revisión', () => {
  test('la URL de una imagen no publicada no viaja en los listados', async () => {
    const autor = await registerAndLogin();
    const topic = await createTopic(autor.cookie);
    const temaId = idOf(topic);
    const reply = await createReply(autor.cookie, { tema_id: temaId });
    const replyId = idOf(reply);
    const url = 'https://res.cloudinary.com/test/image/upload/en_revision.jpg';

    await pool.query(
      `INSERT INTO adjunto (contenido_id, url, public_id, nombre_original, tipo, tamano, estado)
       VALUES ($1, $2, 'udelarhits/adjuntos/en_revision', 'foto.jpg', 'imagen', 1234, 'pendiente_revision')`,
      [replyId, url]
    );

    const res = await request(app).get(`/api/replies/topic/${temaId}`);
    expect(res.status).toBe(200);
    const comentario = res.body.data.find((c) => Number(c.id) === Number(replyId));
    expect(comentario.adjuntos).toHaveLength(1);
    expect(comentario.adjuntos[0].estado).toBe('pendiente_revision');
    expect(comentario.adjuntos[0].url).toBeNull();
    expect(JSON.stringify(res.body)).not.toContain(url);
  });
});
