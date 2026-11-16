import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import {
  registerAndLogin, createAdmin, createCategory, createTopic, createReply, createHomeReply,
} from '../helpers.js';

const idOf = (x) => Number(x.contenido_id ?? x.id);
const pendientes = (cookie) => request(app).get('/api/admin/pending-count').set('Cookie', cookie);
const comentarios = (cookie, qs = '') => request(app).get(`/api/admin/comments${qs}`).set('Cookie', cookie);

describe('GET /admin/pending-count', () => {
  test('sin sesión → 401; sin rol admin → 403', async () => {
    expect((await request(app).get('/api/admin/pending-count')).status).toBe(401);
    const normal = await registerAndLogin();
    expect((await pendientes(normal.cookie)).status).toBe(403);
  });

  test('sin nada pendiente devuelve todo en cero', async () => {
    const admin = await createAdmin();
    const res = await pendientes(admin.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({ apelaciones: 0, reportes: 0, imagenes: 0, total: 0 });
  });

  test('cuenta apelaciones, reportes de usuario e imágenes en revisión, y baja al resolverlos', async () => {
    const admin = await createAdmin();
    const autor = await registerAndLogin();
    const otro = await registerAndLogin();

    // Apelación: el admin tumba un tema y el autor apela.
    const tema = await createTopic(autor.cookie);
    await request(app).post('/api/reports/create').set('Cookie', admin.cookie)
      .send({ contenido_id: idOf(tema), motivo: 'spam' });
    const apelacion = await request(app).post('/api/appeals/create').set('Cookie', autor.cookie)
      .send({ contenido_id: idOf(tema), justificacion: 'Mi tema no viola ninguna norma' });
    expect(apelacion.status).toBe(201);

    // Reporte de usuario.
    const reporte = await request(app).post(`/api/user-reports/${autor.user.nickname}/report`)
      .set('Cookie', otro.cookie).send({ motivo: 'Publica spam en todas las categorías' });
    expect(reporte.status).toBeLessThan(300);

    // Imágenes: un adjunto y un avatar en revisión.
    const com = await createHomeReply(autor.cookie);
    await pool.query(
      `INSERT INTO adjunto (contenido_id, url, public_id, nombre_original, tipo, tamano, estado)
       VALUES ($1, 'u', 'p', 'foto.png', 'imagen', 10, 'pendiente_revision')`,
      [idOf(com)]
    );
    await pool.query(
      `INSERT INTO imagen_pendiente (usuario_id, url, public_id, tipo) VALUES ($1, 'u', 'p2', 'avatar')`,
      [autor.user.id]
    );

    const res = await pendientes(admin.cookie);
    expect(res.body.data).toEqual({ apelaciones: 1, reportes: 1, imagenes: 2, total: 4 });

    // Coincide con lo que muestra cada pestaña del panel.
    const lista = await request(app).get('/api/admin/pending-images').set('Cookie', admin.cookie);
    expect(lista.body.data).toHaveLength(2);

    await pool.query(`UPDATE reporte_usuario SET estado = 'resuelto'`);
    expect((await pendientes(admin.cookie)).body.data).toMatchObject({ reportes: 0, total: 3 });
  });

  test('un adjunto publicado o rechazado no cuenta', async () => {
    const admin = await createAdmin();
    const autor = await registerAndLogin();
    const com = await createHomeReply(autor.cookie);
    await pool.query(
      `INSERT INTO adjunto (contenido_id, url, public_id, nombre_original, tipo, tamano, estado)
       VALUES ($1, 'u1', 'p1', 'a.png', 'imagen', 10, 'publicado'),
              ($1, 'u2', 'p2', 'b.png', 'imagen', 10, 'rechazado')`,
      [idOf(com)]
    );
    expect((await pendientes(admin.cookie)).body.data.imagenes).toBe(0);
  });
});

describe('GET /admin/comments', () => {
  test('sin sesión → 401; sin rol admin → 403', async () => {
    expect((await request(app).get('/api/admin/comments')).status).toBe(401);
    const normal = await registerAndLogin();
    expect((await comentarios(normal.cookie)).status).toBe(403);
  });

  test('lista comentarios de Home, de categoría, de tema y respuestas, del más nuevo al más viejo', async () => {
    const admin = await createAdmin();
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie, { titulo: 'Cálculo' });
    const tema = await createTopic(a.cookie, { categoria_id: cat.id, titulo: 'Parcial' });
    const home = await createHomeReply(a.cookie, { cuerpo: 'en home' });
    const enCat = await createReply(a.cookie, { categoria_id: cat.id, cuerpo: 'en categoría' });
    const enTema = await createReply(a.cookie, { tema_id: tema.id ?? tema.contenido_id, cuerpo: 'en tema' });
    const resp = await createReply(a.cookie, { comentario_padre_id: idOf(home), cuerpo: 'respuesta' });

    const res = await comentarios(admin.cookie);
    expect(res.status).toBe(200);
    const { items, total } = res.body.data;
    expect(total).toBe(4);
    expect(items.map(c => Number(c.id))).toEqual([idOf(resp), idOf(enTema), idOf(enCat), idOf(home)]);

    const porId = Object.fromEntries(items.map(c => [Number(c.id), c]));
    expect(porId[idOf(home)]).toMatchObject({ tipo: 'home', es_respuesta: false, autor_nickname: a.user.nickname });
    expect(porId[idOf(enCat)]).toMatchObject({ tipo: 'categoria', destino_titulo: 'Cálculo' });
    expect(porId[idOf(enTema)]).toMatchObject({ tipo: 'tema', destino_titulo: 'Parcial' });
    expect(porId[idOf(resp)]).toMatchObject({ tipo: 'home', es_respuesta: true });
  });

  test('filtra por estado e incluye los ocultos', async () => {
    const admin = await createAdmin();
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const visible = await createHomeReply(a.cookie, { cuerpo: 'visible' });
    const oculto = await createHomeReply(a.cookie, { cuerpo: 'se oculta' });
    const hija = await createReply(b.cookie, { comentario_padre_id: idOf(oculto) });
    // Con respuestas, el borrado del autor deja el comentario oculto.
    await request(app).delete(`/api/replies/delete/${idOf(oculto)}`).set('Cookie', a.cookie);

    const ocultos = (await comentarios(admin.cookie, '?estado=oculto')).body.data;
    expect(ocultos.items.map(c => Number(c.id))).toEqual([idOf(oculto)]);
    expect(ocultos.total).toBe(1);

    const visibles = (await comentarios(admin.cookie, '?estado=visible')).body.data;
    expect(visibles.items.map(c => Number(c.id)).sort()).toEqual([idOf(visible), idOf(hija)].sort());

    expect((await comentarios(admin.cookie, '?estado=todos')).body.data.total).toBe(3);
    expect((await comentarios(admin.cookie, '?estado=raro')).status).toBe(400);
  });

  test('busca por texto o por autor, tratando % y _ como texto literal', async () => {
    const admin = await createAdmin();
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const uno = await createHomeReply(a.cookie, { cuerpo: 'Busco apuntes de Física' });
    await createHomeReply(b.cookie, { cuerpo: 'otra cosa' });
    const conPorcentaje = await createHomeReply(b.cookie, { cuerpo: 'aprobé con 100% de asistencia' });

    const porTexto = (await comentarios(admin.cookie, '?q=apuntes')).body.data;
    expect(porTexto.items.map(c => Number(c.id))).toEqual([idOf(uno)]);

    const porAutor = (await comentarios(admin.cookie, `?q=${a.user.nickname}`)).body.data;
    expect(porAutor.items.map(c => Number(c.id))).toEqual([idOf(uno)]);

    const literal = (await comentarios(admin.cookie, `?q=${encodeURIComponent('100%')}`)).body.data;
    expect(literal.items.map(c => Number(c.id))).toEqual([idOf(conPorcentaje)]);
    expect((await comentarios(admin.cookie, `?q=${encodeURIComponent('%')}`)).body.data.total).toBe(1);
  });

  test('pagina con limit y offset sin repetir', async () => {
    const admin = await createAdmin();
    const a = await registerAndLogin();
    const ids = [];
    for (let i = 0; i < 5; i++) ids.push(idOf(await createHomeReply(a.cookie, { cuerpo: `c${i}` })));

    const p1 = (await comentarios(admin.cookie, '?limit=2')).body.data;
    const p2 = (await comentarios(admin.cookie, '?limit=2&offset=2')).body.data;
    const p3 = (await comentarios(admin.cookie, '?limit=2&offset=4')).body.data;
    expect(p1.total).toBe(5);
    expect([...p1.items, ...p2.items, ...p3.items].map(c => Number(c.id))).toEqual([...ids].reverse());
  });

  test('el admin puede eliminar un comentario ajeno desde el panel', async () => {
    const admin = await createAdmin();
    const a = await registerAndLogin();
    const com = await createHomeReply(a.cookie);

    const del = await request(app).delete(`/api/replies/delete/${idOf(com)}`).set('Cookie', admin.cookie);
    expect(del.status).toBe(200);
    expect((await comentarios(admin.cookie)).body.data.total).toBe(0);
  });
});
