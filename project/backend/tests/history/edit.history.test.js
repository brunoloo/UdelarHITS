import '../load-env.js';
import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createCategory, createTopic, createReply, getTagIds } from '../helpers.js';

const idOf = (r) => r.id ?? r.contenido_id;

let progIds, gamingIds;
beforeAll(async () => {
  progIds = await getTagIds(['Programación']);
  gamingIds = await getTagIds(['Gaming']);
});

// ─── Historial de ediciones de CATEGORÍA ───

describe('historial de ediciones — categoría', () => {
  test('categoría sin editar devuelve historial vacío', async () => {
    const user = await registerAndLogin();
    const cat = await createCategory(user.cookie);

    const res = await request(app).get(`/api/categories/${cat.id}/history`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  test('editar descripción crea una entrada en el historial', async () => {
    const user = await registerAndLogin();
    const cat = await createCategory(user.cookie, { descripcion: 'Original' });

    await request(app).patch(`/api/categories/${cat.id}`)
      .set('Cookie', user.cookie)
      .send({ descripcion: 'Editada', etiquetas: progIds });

    const res = await request(app).get(`/api/categories/${cat.id}/history`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].descripcion_anterior).toBe('Original');
    expect(res.body.data[0].descripcion_nueva).toBe('Editada');
    expect(res.body.data[0].editor_nickname).toBe(user.user.nickname);
    expect(res.body.data[0].fecha_edicion).toBeDefined();
  });

  test('editar con la misma descripción NO crea entrada', async () => {
    const user = await registerAndLogin();
    const cat = await createCategory(user.cookie, { descripcion: 'Misma' });

    await request(app).patch(`/api/categories/${cat.id}`)
      .set('Cookie', user.cookie)
      .send({ descripcion: 'Misma', etiquetas: progIds });

    const res = await request(app).get(`/api/categories/${cat.id}/history`);
    expect(res.body.data).toHaveLength(0);
  });

  test('editar solo etiquetas (sin cambiar descripción) NO crea entrada', async () => {
    const user = await registerAndLogin();
    const cat = await createCategory(user.cookie, { descripcion: 'Fija' });

    await request(app).patch(`/api/categories/${cat.id}`)
      .set('Cookie', user.cookie)
      .send({ descripcion: 'Fija', etiquetas: gamingIds });

    const res = await request(app).get(`/api/categories/${cat.id}/history`);
    expect(res.body.data).toHaveLength(0);
  });

  test('múltiples ediciones crean múltiples entradas en orden descendente', async () => {
    const user = await registerAndLogin();
    const cat = await createCategory(user.cookie, { descripcion: 'v1' });

    await request(app).patch(`/api/categories/${cat.id}`)
      .set('Cookie', user.cookie)
      .send({ descripcion: 'v2', etiquetas: progIds });

    await new Promise(r => setTimeout(r, 50));

    await request(app).patch(`/api/categories/${cat.id}`)
      .set('Cookie', user.cookie)
      .send({ descripcion: 'v3', etiquetas: progIds });

    const res = await request(app).get(`/api/categories/${cat.id}/history`);
    expect(res.body.data).toHaveLength(2);

    expect(res.body.data[0].descripcion_anterior).toBe('v2');
    expect(res.body.data[0].descripcion_nueva).toBe('v3');
    expect(res.body.data[1].descripcion_anterior).toBe('v1');
    expect(res.body.data[1].descripcion_nueva).toBe('v2');
  });

  test('el historial es público (no requiere autenticación)', async () => {
    const user = await registerAndLogin();
    const cat = await createCategory(user.cookie, { descripcion: 'Pública' });

    await request(app).patch(`/api/categories/${cat.id}`)
      .set('Cookie', user.cookie)
      .send({ descripcion: 'Editada', etiquetas: progIds });

    const res = await request(app).get(`/api/categories/${cat.id}/history`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  test('historial de categoría inexistente → 404', async () => {
    const res = await request(app).get('/api/categories/999999/history');
    expect(res.status).toBe(404);
  });
});

// ─── Historial de ediciones de TEMA ───

describe('historial de ediciones — tema', () => {
  test('tema sin editar devuelve historial vacío', async () => {
    const user = await registerAndLogin();
    const topic = await createTopic(user.cookie);

    const res = await request(app).get(`/api/topics/${idOf(topic)}/history`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  test('editar cuerpo del tema crea una entrada en el historial', async () => {
    const user = await registerAndLogin();
    const topic = await createTopic(user.cookie, { cuerpo: 'Cuerpo original' });

    await request(app).patch(`/api/topics/${idOf(topic)}`)
      .set('Cookie', user.cookie)
      .send({ cuerpo: 'Cuerpo editado' });

    const res = await request(app).get(`/api/topics/${idOf(topic)}/history`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].contenido_anterior).toBe('Cuerpo original');
    expect(res.body.data[0].contenido_nuevo).toBe('Cuerpo editado');
    expect(res.body.data[0].editor_nickname).toBe(user.user.nickname);
  });

  test('editar con el mismo cuerpo NO crea entrada', async () => {
    const user = await registerAndLogin();
    const topic = await createTopic(user.cookie, { cuerpo: 'Sin cambio' });

    await request(app).patch(`/api/topics/${idOf(topic)}`)
      .set('Cookie', user.cookie)
      .send({ cuerpo: 'Sin cambio' });

    const res = await request(app).get(`/api/topics/${idOf(topic)}/history`);
    expect(res.body.data).toHaveLength(0);
  });

  test('múltiples ediciones crean múltiples entradas en orden descendente', async () => {
    const user = await registerAndLogin();
    const topic = await createTopic(user.cookie, { cuerpo: 'v1' });

    await request(app).patch(`/api/topics/${idOf(topic)}`)
      .set('Cookie', user.cookie)
      .send({ cuerpo: 'v2' });

    await new Promise(r => setTimeout(r, 50));

    await request(app).patch(`/api/topics/${idOf(topic)}`)
      .set('Cookie', user.cookie)
      .send({ cuerpo: 'v3' });

    const res = await request(app).get(`/api/topics/${idOf(topic)}/history`);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].contenido_anterior).toBe('v2');
    expect(res.body.data[0].contenido_nuevo).toBe('v3');
    expect(res.body.data[1].contenido_anterior).toBe('v1');
    expect(res.body.data[1].contenido_nuevo).toBe('v2');
  });

  test('el historial es público (no requiere autenticación)', async () => {
    const user = await registerAndLogin();
    const topic = await createTopic(user.cookie, { cuerpo: 'Original' });

    await request(app).patch(`/api/topics/${idOf(topic)}`)
      .set('Cookie', user.cookie)
      .send({ cuerpo: 'Editado' });

    const res = await request(app).get(`/api/topics/${idOf(topic)}/history`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  test('historial de tema inexistente → 404', async () => {
    const res = await request(app).get('/api/topics/999999/history');
    expect(res.status).toBe(404);
  });
});

// ─── Historial de ediciones de COMENTARIO ───

describe('historial de ediciones — comentario', () => {
  test('comentario sin editar devuelve historial vacío', async () => {
    const user = await registerAndLogin();
    const reply = await createReply(user.cookie);

    const res = await request(app).get(`/api/replies/${idOf(reply)}/history`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  test('editar comentario crea una entrada en el historial', async () => {
    const user = await registerAndLogin();
    const reply = await createReply(user.cookie, { cuerpo: 'Comentario original' });

    await request(app).patch(`/api/replies/update/${idOf(reply)}`)
      .set('Cookie', user.cookie)
      .send({ cuerpo: 'Comentario editado' });

    const res = await request(app).get(`/api/replies/${idOf(reply)}/history`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].contenido_anterior).toBe('Comentario original');
    expect(res.body.data[0].contenido_nuevo).toBe('Comentario editado');
    expect(res.body.data[0].editor_nickname).toBe(user.user.nickname);
  });

  test('editar con el mismo cuerpo NO crea entrada', async () => {
    const user = await registerAndLogin();
    const reply = await createReply(user.cookie, { cuerpo: 'Igual' });

    await request(app).patch(`/api/replies/update/${idOf(reply)}`)
      .set('Cookie', user.cookie)
      .send({ cuerpo: 'Igual' });

    const res = await request(app).get(`/api/replies/${idOf(reply)}/history`);
    expect(res.body.data).toHaveLength(0);
  });

  test('múltiples ediciones crean múltiples entradas en orden descendente', async () => {
    const user = await registerAndLogin();
    const reply = await createReply(user.cookie, { cuerpo: 'v1' });

    await request(app).patch(`/api/replies/update/${idOf(reply)}`)
      .set('Cookie', user.cookie)
      .send({ cuerpo: 'v2' });

    await new Promise(r => setTimeout(r, 50));

    await request(app).patch(`/api/replies/update/${idOf(reply)}`)
      .set('Cookie', user.cookie)
      .send({ cuerpo: 'v3' });

    const res = await request(app).get(`/api/replies/${idOf(reply)}/history`);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].contenido_anterior).toBe('v2');
    expect(res.body.data[0].contenido_nuevo).toBe('v3');
    expect(res.body.data[1].contenido_anterior).toBe('v1');
    expect(res.body.data[1].contenido_nuevo).toBe('v2');
  });

  test('el historial es público (no requiere autenticación)', async () => {
    const user = await registerAndLogin();
    const reply = await createReply(user.cookie, { cuerpo: 'Original' });

    await request(app).patch(`/api/replies/update/${idOf(reply)}`)
      .set('Cookie', user.cookie)
      .send({ cuerpo: 'Editado' });

    const res = await request(app).get(`/api/replies/${idOf(reply)}/history`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  test('historial de comentario inexistente → 404', async () => {
    const res = await request(app).get('/api/replies/999999/history');
    expect(res.status).toBe(404);
  });
});
