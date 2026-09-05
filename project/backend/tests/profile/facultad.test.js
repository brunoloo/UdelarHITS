import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createCategory, createTopic, createReply } from '../helpers.js';

// Campo `facultad` del perfil: opcional, validado contra el catálogo `etiqueta`
// (grupo 'Facultades'). Se guarda la ABREVIATURA canónica y viaja junto al autor
// en el contenido como `autor_facultad`.

describe('Perfil — campo facultad', () => {
  it('PATCH /users/me acepta solo facultad (sin nombre ni biografía)', async () => {
    const u = await registerAndLogin();

    const res = await request(app).patch('/api/users/me')
      .set('Cookie', u.cookie)
      .send({ facultad: 'FING' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.facultad).toBe('FING');
  });

  it('GET /users/me devuelve la abreviatura y el nombre completo', async () => {
    const u = await registerAndLogin();
    await request(app).patch('/api/users/me')
      .set('Cookie', u.cookie).send({ facultad: 'FING' });

    const res = await request(app).get('/api/users/me').set('Cookie', u.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.user.facultad).toBe('FING');
    expect(res.body.data.user.facultad_nombre).toBe('Facultad de Ingeniería');
  });

  it('GET /users/:nickname expone facultad sin filtrar campos sensibles', async () => {
    const autor = await registerAndLogin();
    await request(app).patch('/api/users/me')
      .set('Cookie', autor.cookie).send({ facultad: 'FING' });

    const viewer = await registerAndLogin();
    const res = await request(app).get(`/api/users/${autor.user.nickname}`)
      .set('Cookie', viewer.cookie);

    expect(res.status).toBe(200);
    expect(res.body.data.user.facultad).toBe('FING');
    expect(res.body.data.user.facultad_nombre).toBe('Facultad de Ingeniería');
    // La proyección pública sigue sin exponer datos sensibles.
    expect(res.body.data.user.email).toBeUndefined();
    expect(res.body.data.user.rol).toBeUndefined();
  });

  it('rechaza una facultad que no existe en el catálogo', async () => {
    const u = await registerAndLogin();

    const res = await request(app).patch('/api/users/me')
      .set('Cookie', u.cookie).send({ facultad: 'NOEXISTE' });

    expect(res.status).toBe(400);
  });

  it('el lookup es case-insensitive y guarda el nombre canónico', async () => {
    const u = await registerAndLogin();

    const res = await request(app).patch('/api/users/me')
      .set('Cookie', u.cookie).send({ facultad: 'fing' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.facultad).toBe('FING');

    const me = await request(app).get('/api/users/me').set('Cookie', u.cookie);
    expect(me.body.data.user.facultad).toBe('FING');
  });

  it('string vacío vacía el campo', async () => {
    const u = await registerAndLogin();
    await request(app).patch('/api/users/me')
      .set('Cookie', u.cookie).send({ facultad: 'FING' });

    const res = await request(app).patch('/api/users/me')
      .set('Cookie', u.cookie).send({ facultad: '' });

    expect(res.status).toBe(200);
    expect(res.body.data.user.facultad).toBeNull();

    const me = await request(app).get('/api/users/me').set('Cookie', u.cookie);
    expect(me.body.data.user.facultad).toBeNull();
    expect(me.body.data.user.facultad_nombre).toBeNull();
  });

  it('expone autor_facultad junto al contenido del usuario', async () => {
    const u = await registerAndLogin();
    await request(app).patch('/api/users/me')
      .set('Cookie', u.cookie).send({ facultad: 'FING' });

    const cat = await createCategory(u.cookie);
    const topic = await createTopic(u.cookie, { categoria_id: cat.id });
    const temaId = topic.id ?? topic.contenido_id;
    await createReply(u.cookie, { tema_id: temaId });
    await createReply(u.cookie, { categoria_id: cat.id });

    const replies = await request(app).get(`/api/replies/topic/${temaId}`);
    expect(replies.status).toBe(200);
    expect(replies.body.data.length).toBeGreaterThan(0);
    expect(replies.body.data[0].autor_facultad).toBe('FING');

    const tema = await request(app).get(`/api/topics/${temaId}`);
    expect(tema.status).toBe(200);
    expect(tema.body.data.autor_facultad).toBe('FING');

    const catRes = await request(app).get(`/api/categories/${cat.id}`);
    expect(catRes.status).toBe(200);
    expect(catRes.body.data.autor_facultad).toBe('FING');

    const catReplies = await request(app).get(`/api/replies/category/${cat.id}`);
    expect(catReplies.status).toBe(200);
    expect(catReplies.body.data[0].autor_facultad).toBe('FING');
  });

  it('autor_facultad es null cuando el usuario no cargó facultad', async () => {
    const u = await registerAndLogin();

    const cat = await createCategory(u.cookie);
    const topic = await createTopic(u.cookie, { categoria_id: cat.id });
    const temaId = topic.id ?? topic.contenido_id;
    await createReply(u.cookie, { tema_id: temaId });

    const replies = await request(app).get(`/api/replies/topic/${temaId}`);
    expect(replies.body.data[0].autor_facultad).toBeNull();

    const tema = await request(app).get(`/api/topics/${temaId}`);
    expect(tema.body.data.autor_facultad).toBeNull();

    const catRes = await request(app).get(`/api/categories/${cat.id}`);
    expect(catRes.body.data.autor_facultad).toBeNull();
  });
});
