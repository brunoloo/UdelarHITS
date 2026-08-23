import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createAdmin, createCategory, createHomeReply, createReply } from '../helpers.js';

// Fijar comentarios de Home en el Home (solo admin). Sólo aplica a comentarios
// de Home de PRIMER NIVEL (es_home = TRUE, sin comentario_padre). El comentario
// fijado encabeza el feed del Home durante un plazo acotado (3, 7 o 30 días); al
// vencer se desancla solo. El destacado del Home es un singleton COMPARTIDO con
// la categoría fijada: fijar uno desancla el otro.

const pinComment = (cookie, id, dias) =>
  request(app).post(`/api/replies/${id}/pin-home`).set('Cookie', cookie).send({ dias });
const unpinComment = (cookie, id) =>
  request(app).delete(`/api/replies/${id}/pin-home`).set('Cookie', cookie);
const pinCategory = (cookie, id, dias) =>
  request(app).post(`/api/categories/${id}/pin-home`).set('Cookie', cookie).send({ dias });

async function feed({ cookie = null } = {}) {
  const req = request(app).get('/api/categories/feed?limit=50');
  if (cookie) req.set('Cookie', cookie);
  const res = await req;
  expect(res.status).toBe(200);
  return res.body.data;
}

// Fuerza el vencimiento de la fijada (simula el paso del tiempo).
async function expirePin(comentarioId) {
  await pool.query(
    `UPDATE comentario SET fijado_home_hasta = NOW() - INTERVAL '1 minute' WHERE contenido_id = $1`,
    [comentarioId]
  );
}

describe('Fijar comentario de Home — permisos', () => {
  test('un usuario común no puede fijar (403)', async () => {
    const admin = await createAdmin();
    const user = await registerAndLogin();
    const com = await createHomeReply(admin.cookie);

    const res = await pinComment(user.cookie, com.contenido_id, 7);
    expect(res.status).toBe(403);
  });

  test('un invitado no puede fijar (401)', async () => {
    const admin = await createAdmin();
    const com = await createHomeReply(admin.cookie);

    const res = await request(app).post(`/api/replies/${com.contenido_id}/pin-home`).send({ dias: 7 });
    expect(res.status).toBe(401);
  });

  test('un usuario común no puede desanclar (403)', async () => {
    const admin = await createAdmin();
    const user = await registerAndLogin();
    const com = await createHomeReply(admin.cookie);
    await pinComment(admin.cookie, com.contenido_id, 7);

    const res = await unpinComment(user.cookie, com.contenido_id);
    expect(res.status).toBe(403);
  });
});

describe('Fijar comentario de Home — validación', () => {
  test('duración no permitida responde 400', async () => {
    const admin = await createAdmin();
    const com = await createHomeReply(admin.cookie);

    for (const dias of [1, 5, 60, 0, -3, 'abc']) {
      const res = await pinComment(admin.cookie, com.contenido_id, dias);
      expect(res.status).toBe(400);
    }
  });

  test('duraciones válidas (3, 7 y 30 días) se aceptan', async () => {
    const admin = await createAdmin();
    const com = await createHomeReply(admin.cookie);

    for (const dias of [3, 7, 30]) {
      const res = await pinComment(admin.cookie, com.contenido_id, dias);
      expect(res.status).toBe(200);
    }
  });

  test('comentario inexistente responde 404', async () => {
    const admin = await createAdmin();
    const res = await pinComment(admin.cookie, 999999, 7);
    expect(res.status).toBe(404);
  });

  test('un comentario de categoría NO se puede fijar (400)', async () => {
    const admin = await createAdmin();
    const cat = await createCategory(admin.cookie);
    const com = await createReply(admin.cookie, { categoria_id: cat.id });

    const res = await pinComment(admin.cookie, com.contenido_id, 7);
    expect(res.status).toBe(400);
  });

  test('una respuesta a un comentario de Home NO se puede fijar (400)', async () => {
    const admin = await createAdmin();
    const padre = await createHomeReply(admin.cookie);
    // La respuesta hereda el ámbito home del padre, pero tiene comentario_padre_id.
    const respuesta = await createReply(admin.cookie, { comentario_padre_id: padre.contenido_id });

    const res = await pinComment(admin.cookie, respuesta.contenido_id, 7);
    expect(res.status).toBe(400);
  });
});

describe('Fijar comentario de Home — comportamiento en el feed', () => {
  test('el comentario fijado encabeza el feed aunque sea el más viejo', async () => {
    const admin = await createAdmin();
    const viejo = await createHomeReply(admin.cookie);
    await createHomeReply(admin.cookie);
    await createHomeReply(admin.cookie);

    // Sin fijar, 'viejo' no encabeza (orden cronológico desc).
    const antes = await feed();
    expect(antes[0].id).not.toBe(viejo.contenido_id);

    const res = await pinComment(admin.cookie, viejo.contenido_id, 7);
    expect(res.status).toBe(200);

    const despues = await feed();
    expect(despues[0].id).toBe(viejo.contenido_id);
    expect(despues[0].tipo).toBe('comentario');
    expect(despues[0].fijado_home).toBe(true);
    // No se filtra la fecha cruda de vigencia.
    expect(despues[0].fijado_home_hasta).toBeUndefined();
  });

  test('el comentario fijado no se duplica en el feed', async () => {
    const admin = await createAdmin();
    const com = await createHomeReply(admin.cookie);
    await createHomeReply(admin.cookie);
    await pinComment(admin.cookie, com.contenido_id, 7);

    const ids = (await feed()).filter(it => it.tipo === 'comentario').map(it => it.id);
    const veces = ids.filter(id => id === com.contenido_id).length;
    expect(veces).toBe(1);
  });

  test('desanclar devuelve el comentario a su orden normal', async () => {
    const admin = await createAdmin();
    const viejo = await createHomeReply(admin.cookie);
    await createHomeReply(admin.cookie);
    await pinComment(admin.cookie, viejo.contenido_id, 7);
    expect((await feed())[0].id).toBe(viejo.contenido_id);

    const res = await unpinComment(admin.cookie, viejo.contenido_id);
    expect(res.status).toBe(200);

    const ids = (await feed()).map(it => it.id);
    expect(ids[0]).not.toBe(viejo.contenido_id); // vuelve al fondo (es el más viejo)
    expect(ids).toContain(viejo.contenido_id);
  });

  test('al vencer el plazo el comentario se desancla solo', async () => {
    const admin = await createAdmin();
    const viejo = await createHomeReply(admin.cookie);
    await createHomeReply(admin.cookie);
    await pinComment(admin.cookie, viejo.contenido_id, 3);
    expect((await feed())[0].id).toBe(viejo.contenido_id);

    await expirePin(viejo.contenido_id);

    const items = await feed();
    const comIds = items.filter(it => it.tipo === 'comentario').map(it => it.id);
    expect(items[0].id).not.toBe(viejo.contenido_id);
    expect(comIds).toContain(viejo.contenido_id);          // sigue en el feed
    expect(comIds.filter(id => id === viejo.contenido_id).length).toBe(1); // sin duplicar
  });

  test('fijar otro comentario desancla automáticamente el anterior (singleton)', async () => {
    const admin = await createAdmin();
    const a = await createHomeReply(admin.cookie);
    const b = await createHomeReply(admin.cookie);

    await pinComment(admin.cookie, a.contenido_id, 7);
    expect((await feed())[0].id).toBe(a.contenido_id);

    await pinComment(admin.cookie, b.contenido_id, 7);
    const items = await feed();
    expect(items[0].id).toBe(b.contenido_id);
    // 'a' ya no está fijado (ningún ítem fijado más que 'b').
    const fijados = items.filter(it => it.fijado_home);
    expect(fijados).toHaveLength(1);
    expect(fijados[0].id).toBe(b.contenido_id);
  });
});

describe('Destacado del Home — singleton compartido categoría ↔ comentario', () => {
  test('fijar un comentario desancla la categoría fijada', async () => {
    const admin = await createAdmin();
    const cat = await createCategory(admin.cookie);
    const com = await createHomeReply(admin.cookie);

    await pinCategory(admin.cookie, cat.id, 7);
    expect((await feed())[0].id).toBe(cat.id);
    expect((await feed())[0].tipo).toBe('categoria');

    await pinComment(admin.cookie, com.contenido_id, 7);
    const items = await feed();
    expect(items[0].id).toBe(com.contenido_id);
    expect(items[0].tipo).toBe('comentario');
    // La categoría dejó de estar fijada.
    const catDetalle = await request(app).get(`/api/categories/${cat.id}`);
    expect(catDetalle.body.data.fijada).toBe(false);
  });

  test('fijar una categoría desancla el comentario fijado', async () => {
    const admin = await createAdmin();
    const cat = await createCategory(admin.cookie);
    const com = await createHomeReply(admin.cookie);

    await pinComment(admin.cookie, com.contenido_id, 7);
    expect((await feed())[0].id).toBe(com.contenido_id);

    await pinCategory(admin.cookie, cat.id, 7);
    const items = await feed();
    expect(items[0].id).toBe(cat.id);
    expect(items[0].tipo).toBe('categoria');
    // El comentario dejó de estar fijado.
    expect(items.filter(it => it.fijado_home)).toHaveLength(0);
  });
});
