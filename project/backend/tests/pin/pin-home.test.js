import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createAdmin, createCategory } from '../helpers.js';

// Fijar categorías en el Home (solo admin). La categoría fijada encabeza el feed
// del Home durante un plazo acotado (3, 7 o 30 días); al vencer se desancla sola.

const pinHome = (cookie, id, dias) =>
  request(app).post(`/api/categories/${id}/pin-home`).set('Cookie', cookie).send({ dias });
const unpinHome = (cookie, id) =>
  request(app).delete(`/api/categories/${id}/pin-home`).set('Cookie', cookie);

async function feedIds({ cookie = null } = {}) {
  const req = request(app).get('/api/categories/feed?limit=50');
  if (cookie) req.set('Cookie', cookie);
  const res = await req;
  expect(res.status).toBe(200);
  return res.body.data.map(c => c.id);
}

// Fuerza el vencimiento de la fijada (simula el paso del tiempo).
async function expirePin(categoriaId) {
  await pool.query(
    `UPDATE categoria SET fijada_hasta = NOW() - INTERVAL '1 minute' WHERE id = $1`,
    [categoriaId]
  );
}

describe('Fijar categoría en el Home — permisos', () => {
  test('un usuario común no puede fijar (403)', async () => {
    const admin = await createAdmin();
    const user = await registerAndLogin();
    const cat = await createCategory(admin.cookie);

    const res = await pinHome(user.cookie, cat.id, 7);
    expect(res.status).toBe(403);
  });

  test('un invitado no puede fijar (401)', async () => {
    const admin = await createAdmin();
    const cat = await createCategory(admin.cookie);

    const res = await request(app).post(`/api/categories/${cat.id}/pin-home`).send({ dias: 7 });
    expect(res.status).toBe(401);
  });

  test('un usuario común no puede desanclar (403)', async () => {
    const admin = await createAdmin();
    const user = await registerAndLogin();
    const cat = await createCategory(admin.cookie);
    await pinHome(admin.cookie, cat.id, 7);

    const res = await unpinHome(user.cookie, cat.id);
    expect(res.status).toBe(403);
  });
});

describe('Fijar categoría en el Home — validación', () => {
  test('duración no permitida responde 400', async () => {
    const admin = await createAdmin();
    const cat = await createCategory(admin.cookie);

    for (const dias of [1, 5, 60, 0, -3, 'abc']) {
      const res = await pinHome(admin.cookie, cat.id, dias);
      expect(res.status).toBe(400);
    }
  });

  test('duraciones válidas (3, 7 y 30 días) se aceptan', async () => {
    const admin = await createAdmin();
    const cat = await createCategory(admin.cookie);

    for (const dias of [3, 7, 30]) {
      const res = await pinHome(admin.cookie, cat.id, dias);
      expect(res.status).toBe(200);
    }
  });

  test('categoría inexistente responde 404', async () => {
    const admin = await createAdmin();
    const res = await pinHome(admin.cookie, 999999, 7);
    expect(res.status).toBe(404);
  });
});

describe('Fijar categoría en el Home — comportamiento en el feed', () => {
  test('la categoría fijada encabeza el feed aunque sea la más vieja', async () => {
    const admin = await createAdmin();
    const vieja = await createCategory(admin.cookie);
    await createCategory(admin.cookie);
    await createCategory(admin.cookie);

    // Sin fijar, 'vieja' iría última (orden cronológico desc).
    const antes = await feedIds();
    expect(antes[0]).not.toBe(vieja.id);

    const res = await pinHome(admin.cookie, vieja.id, 7);
    expect(res.status).toBe(200);

    const despues = await feedIds();
    expect(despues[0]).toBe(vieja.id);
  });

  test('la categoría fijada no se duplica en el feed', async () => {
    const admin = await createAdmin();
    const cat = await createCategory(admin.cookie);
    await createCategory(admin.cookie);
    await pinHome(admin.cookie, cat.id, 7);

    const ids = await feedIds();
    const veces = ids.filter(id => id === cat.id).length;
    expect(veces).toBe(1);
    expect(ids[0]).toBe(cat.id);
  });

  test('la card fijada llega con fijada=true; el resto con fijada=false', async () => {
    const admin = await createAdmin();
    const cat = await createCategory(admin.cookie);
    await createCategory(admin.cookie);
    await pinHome(admin.cookie, cat.id, 7);

    const res = await request(app).get('/api/categories/feed?limit=50');
    const [first, ...rest] = res.body.data;
    expect(first.id).toBe(cat.id);
    expect(first.fijada).toBe(true);
    expect(rest.every(c => c.fijada === false)).toBe(true);
    // No se filtra la fecha cruda de vigencia.
    expect(first.fijada_hasta).toBeUndefined();
  });

  test('fijar otra categoría desancla automáticamente la anterior (singleton)', async () => {
    const admin = await createAdmin();
    const a = await createCategory(admin.cookie);
    const b = await createCategory(admin.cookie);

    await pinHome(admin.cookie, a.id, 7);
    expect((await feedIds())[0]).toBe(a.id);

    await pinHome(admin.cookie, b.id, 7);
    const ids = await feedIds();
    expect(ids[0]).toBe(b.id);
    // 'a' vuelve a su lugar cronológico, sin quedar fijada.
    const catA = await request(app).get(`/api/categories/${a.id}`);
    expect(catA.body.data.fijada).toBe(false);
  });

  test('desanclar devuelve la categoría a su orden normal', async () => {
    const admin = await createAdmin();
    const vieja = await createCategory(admin.cookie);
    await createCategory(admin.cookie);
    await pinHome(admin.cookie, vieja.id, 7);
    expect((await feedIds())[0]).toBe(vieja.id);

    const res = await unpinHome(admin.cookie, vieja.id);
    expect(res.status).toBe(200);

    const ids = await feedIds();
    expect(ids[0]).not.toBe(vieja.id); // vuelve al fondo (es la más vieja)
    expect(ids).toContain(vieja.id);
  });

  test('al vencer el plazo la categoría se desancla sola', async () => {
    const admin = await createAdmin();
    const vieja = await createCategory(admin.cookie);
    await createCategory(admin.cookie);
    await pinHome(admin.cookie, vieja.id, 3);
    expect((await feedIds())[0]).toBe(vieja.id);

    await expirePin(vieja.id);

    const ids = await feedIds();
    expect(ids[0]).not.toBe(vieja.id);
    expect(ids).toContain(vieja.id); // sigue en el feed, sin duplicar
    expect(ids.filter(id => id === vieja.id).length).toBe(1);
  });

  test('la fijada encabeza también el feed personalizado', async () => {
    const admin = await createAdmin();
    const fijada = await createCategory(admin.cookie);

    // Usuario con señal (participación): su categoría propia normalmente encabeza.
    const user = await registerAndLogin();
    const propia = await createCategory(user.cookie);

    await pinHome(admin.cookie, fijada.id, 7);

    const ids = await feedIds({ cookie: user.cookie });
    expect(ids[0]).toBe(fijada.id);       // la fijada gana incluso a la propia
    expect(ids).toContain(propia.id);
    expect(ids.filter(id => id === fijada.id).length).toBe(1);
  });

  test('la fijada aparece sólo en la primera página, no al paginar', async () => {
    const admin = await createAdmin();
    const creadas = [];
    for (let i = 0; i < 12; i++) creadas.push(await createCategory(admin.cookie));
    const fijada = creadas[0]; // la más vieja
    await pinHome(admin.cookie, fijada.id, 7);

    const p1 = await request(app).get('/api/categories/feed?limit=5');
    expect(p1.body.data[0].id).toBe(fijada.id);

    // Recorremos las páginas siguientes: la fijada no debe reaparecer.
    let cursor = p1.body.nextCursor;
    let reapariciones = 0;
    for (let page = 0; page < 10 && cursor; page++) {
      const res = await request(app).get(`/api/categories/feed?limit=5&cursor=${encodeURIComponent(cursor)}`);
      reapariciones += res.body.data.filter(c => c.id === fijada.id).length;
      cursor = res.body.nextCursor;
    }
    expect(reapariciones).toBe(0);
  });
});

describe('Detalle de categoría — estado de fijada', () => {
  test('GET /:id refleja fijada=true tras fijar y false tras desanclar', async () => {
    const admin = await createAdmin();
    const cat = await createCategory(admin.cookie);

    let res = await request(app).get(`/api/categories/${cat.id}`);
    expect(res.body.data.fijada).toBe(false);

    await pinHome(admin.cookie, cat.id, 7);
    res = await request(app).get(`/api/categories/${cat.id}`);
    expect(res.body.data.fijada).toBe(true);

    await unpinHome(admin.cookie, cat.id);
    res = await request(app).get(`/api/categories/${cat.id}`);
    expect(res.body.data.fijada).toBe(false);
  });
});
