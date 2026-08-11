import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createCategory, createTopic, createReply, createHomeReply } from '../helpers.js';

const post = (cookie, body) => request(app).post('/api/replies/create').set('Cookie', cookie).send(body);
const getNotifs = (cookie) => request(app).get('/api/notifications').set('Cookie', cookie).then(r => r.body.data);
const idOf = (x) => x.id ?? x.contenido_id;

// PNG 1x1 real (magic numbers válidos) para el caso con adjunto.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64'
);

async function comentarioEnBD(contenidoId) {
  const { rows } = await pool.query(
    'SELECT tema_id, categoria_id, es_home, comentario_padre_id, estado FROM comentario WHERE contenido_id = $1',
    [contenidoId]
  );
  return rows[0] || null;
}

describe('Comentarios de Home — creación', () => {
  test('con sesión y es_home → 201, es_home=TRUE, ambos FKs NULL', async () => {
    const u = await registerAndLogin();
    const res = await post(u.cookie, { cuerpo: 'hola home', es_home: true });
    expect(res.status).toBe(201);
    expect(res.body.data.es_home).toBe(true);
    expect(res.body.data.tema_id).toBeNull();
    expect(res.body.data.categoria_id).toBeNull();

    const fila = await comentarioEnBD(res.body.data.contenido_id);
    expect(fila.es_home).toBe(true);
    expect(fila.tema_id).toBeNull();
    expect(fila.categoria_id).toBeNull();
    expect(fila.comentario_padre_id).toBeNull();
  });

  test('sin sesión → 401', async () => {
    const res = await request(app).post('/api/replies/create').send({ cuerpo: 'x', es_home: true });
    expect(res.status).toBe(401);
  });

  test('combinación inválida (es_home + categoria_id) → 400', async () => {
    const u = await registerAndLogin();
    const cat = await createCategory(u.cookie);
    const res = await post(u.cookie, { cuerpo: 'x', es_home: true, categoria_id: cat.id });
    expect(res.status).toBe(400);
  });

  test('combinación inválida (es_home + comentario_padre_id) → 400', async () => {
    const u = await registerAndLogin();
    const padre = await createHomeReply(u.cookie);
    const res = await post(u.cookie, { cuerpo: 'x', es_home: true, comentario_padre_id: idOf(padre) });
    expect(res.status).toBe(400);
  });

  test('con encuesta → 201, la encuesta se crea', async () => {
    const u = await registerAndLogin();
    const res = await post(u.cookie, {
      cuerpo: 'con encuesta',
      es_home: true,
      encuesta: { opciones: ['A', 'B'], duracion_segundos: 3600 },
    });
    expect(res.status).toBe(201);
    expect(res.body.data.es_home).toBe(true);
    expect(res.body.data.encuesta).toBeTruthy();
    expect(res.body.data.encuesta.opciones).toHaveLength(2);
  });

  test('con adjunto → 201, el adjunto se persiste', async () => {
    const u = await registerAndLogin();
    const res = await request(app).post('/api/replies/create')
      .set('Cookie', u.cookie)
      .field('cuerpo', 'home con foto')
      .field('es_home', 'true')
      .attach('archivos', png, { filename: 'foto.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.data.es_home).toBe(true);
    expect(res.body.data.adjuntos).toHaveLength(1);
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM adjunto WHERE contenido_id = $1', [res.body.data.contenido_id]);
    expect(rows[0].n).toBe(1);
  });
});

describe('Comentarios de Home — respuestas', () => {
  test('respuesta a comentario de Home hereda es_home y notifica al autor padre', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const padre = await createHomeReply(a.cookie, { cuerpo: 'comentario padre home' });

    const res = await post(b.cookie, { cuerpo: 'respuesta', comentario_padre_id: idOf(padre) });
    expect(res.status).toBe(201);

    const fila = await comentarioEnBD(res.body.data.contenido_id);
    expect(fila.es_home).toBe(true);
    expect(fila.tema_id).toBeNull();
    expect(fila.categoria_id).toBeNull();
    expect(Number(fila.comentario_padre_id)).toBe(Number(idOf(padre)));

    // El autor del comentario padre recibe la notificación con URL al permalink.
    const notifs = await getNotifs(a.cookie);
    const n = notifs.find(x => x.tipo === 'respuesta_comentario');
    expect(n).toBeDefined();
    expect(n.url).toBe(`/comment/${res.body.data.contenido_id}`);
  });
});

describe('Comentarios de Home — aislamiento', () => {
  test('NO aparece en /replies/category/:id ni /replies/topic/:id', async () => {
    const u = await registerAndLogin();
    const cat = await createCategory(u.cookie);
    const topic = await createTopic(u.cookie, { categoria_id: cat.id });
    const catComment = await createReply(u.cookie, { categoria_id: cat.id, cuerpo: 'comentario de categoría' });
    const home = await createHomeReply(u.cookie, { cuerpo: 'comentario de home' });

    const byCat = await request(app).get(`/api/replies/category/${cat.id}`).then(r => r.body.data);
    const byTopic = await request(app).get(`/api/replies/topic/${idOf(topic)}`).then(r => r.body.data);

    expect(byCat.map(c => c.id)).toContain(catComment.contenido_id);
    expect(byCat.map(c => c.id)).not.toContain(home.contenido_id);
    expect(byTopic.map(c => c.id)).not.toContain(home.contenido_id);
  });

  test('NO dispara notificación a suscriptores de ninguna categoría', async () => {
    const mod = await registerAndLogin();
    const visitor = await registerAndLogin();
    const autor = await registerAndLogin();
    const cat = await createCategory(mod.cookie);
    await request(app).post(`/api/categories/${cat.id}/subscribe`).set('Cookie', visitor.cookie);

    await createHomeReply(autor.cookie, { cuerpo: 'comentario global, no toca la categoría' });

    const notifs = await getNotifs(visitor.cookie);
    expect(notifs.find(x => x.tipo === 'comentario_categoria_seguida')).toBeUndefined();
  });
});

describe('Comentarios de Home — eliminación', () => {
  test('sin respuestas → hard delete (la fila desaparece)', async () => {
    const u = await registerAndLogin();
    const home = await createHomeReply(u.cookie, { cuerpo: 'a borrar' });

    const res = await request(app).delete(`/api/replies/delete/${home.contenido_id}`).set('Cookie', u.cookie);
    expect(res.status).toBe(200);
    expect(await comentarioEnBD(home.contenido_id)).toBeNull();
  });

  test('con respuestas → soft delete (queda oculto como placeholder)', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const padre = await createHomeReply(a.cookie, { cuerpo: 'padre con respuesta' });
    await post(b.cookie, { cuerpo: 'respuesta', comentario_padre_id: idOf(padre) });

    const res = await request(app).delete(`/api/replies/delete/${padre.contenido_id}`).set('Cookie', a.cookie);
    expect(res.status).toBe(200);
    const fila = await comentarioEnBD(padre.contenido_id);
    expect(fila).not.toBeNull();
    expect(fila.estado).toBe('oculto');
    expect(fila.es_home).toBe(true);
  });
});
