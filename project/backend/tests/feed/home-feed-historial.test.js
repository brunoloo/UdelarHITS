import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createCategory, createReply, getTagIds } from '../helpers.js';
import { getRankedCategoryFeed } from '../../src/repositories/category.repository.js';
import { PERFIL_CHICO } from '../../src/config/feedConfig.js';
import {
  perfilDesdeIntensidad,
  _setFeedIntensityOverride, _setFeedSeedOverride, _resetFeedRanking,
} from '../../src/services/feedRanking.service.js';

afterEach(() => _resetFeedRanking());

const catIds = async (cookie) => {
  const res = await request(app).get('/api/categories/feed?limit=50').set('Cookie', cookie);
  expect(res.status).toBe(200);
  return res.body.data.filter(i => i.tipo === 'categoria').map(i => Number(i.id));
};

// Todo queda fuera de la ventana de 7 días: sin actividad reciente, la edad empata.
const envejecerTodo = async () => {
  await pool.query(`UPDATE contenido SET fecha_creacion = NOW() - INTERVAL '40 days'`);
  await pool.query(`UPDATE categoria SET fecha_creacion = NOW() - INTERVAL '40 days'`);
};

// Sin jitter (J = 0) el orden lo decide solo la fórmula.
const ordenSinJitter = async (viewerId, over = {}) => {
  const rows = await getRankedCategoryFeed(viewerId, {
    limit: 50, t0: Math.floor(Date.now() / 1000), seed: 1,
    p: { ...PERFIL_CHICO, J: 0, ...over },
  });
  return rows.map(r => Number(r.id));
};

describe('Feed rankeado — contenido acumulado (W_HIST)', () => {
  test('el perfil interpola W_HIST entre foro chico y grande', () => {
    expect(perfilDesdeIntensidad(0).W_HIST).toBeCloseTo(0.25);
    expect(perfilDesdeIntensidad(1).W_HIST).toBeCloseTo(0.05);
  });

  test('con la semana quieta, una categoría con conversación va antes que una vacía', async () => {
    const otro = await registerAndLogin();
    const conContenido = await createCategory(otro.cookie);
    const vacia = await createCategory(otro.cookie);
    for (let i = 0; i < 8; i++) await createReply(otro.cookie, { categoria_id: conContenido.id });
    await envejecerTodo();
    const yo = await registerAndLogin();

    expect(await ordenSinJitter(yo.user.id)).toEqual([conContenido.id, vacia.id].map(Number));
    // Sin el término, empatan y gana el id más alto: la vacía, creada después.
    expect(await ordenSinJitter(yo.user.id, { W_HIST: 0 })).toEqual([vacia.id, conContenido.id].map(Number));
  });

  test('en el foro chico la ventaja es una tendencia: la rotación sigue existiendo', async () => {
    _setFeedIntensityOverride(0);
    const otro = await registerAndLogin();
    const conContenido = await createCategory(otro.cookie);
    const vacia = await createCategory(otro.cookie);
    for (let i = 0; i < 15; i++) await createReply(otro.cookie, { categoria_id: conContenido.id });
    await envejecerTodo();
    const yo = await registerAndLogin();

    let conContenidoPrimero = 0;
    const visitas = 40;
    for (let seed = 1; seed <= visitas; seed++) {
      _setFeedSeedOverride(seed);
      const ids = await catIds(yo.cookie);
      if (ids.indexOf(Number(conContenido.id)) < ids.indexOf(Number(vacia.id))) conContenidoPrimero++;
    }
    expect(conContenidoPrimero).toBeGreaterThan(visitas * 0.6);
    expect(conContenidoPrimero).toBeLessThan(visitas);
  });

  test('un tema o comentario oculto no suma al historial', async () => {
    const otro = await registerAndLogin();
    const conOcultos = await createCategory(otro.cookie);
    const conUno = await createCategory(otro.cookie);
    for (let i = 0; i < 5; i++) await createReply(otro.cookie, { categoria_id: conOcultos.id });
    await pool.query(`UPDATE comentario SET estado = 'oculto' WHERE categoria_id = $1`, [conOcultos.id]);
    await createReply(otro.cookie, { categoria_id: conUno.id });
    await envejecerTodo();
    const yo = await registerAndLogin();

    expect(await ordenSinJitter(yo.user.id)).toEqual([conUno.id, conOcultos.id].map(Number));
  });
});

describe('Feed rankeado — afinidad por facultad (W_FAC)', () => {
  test('una categoría de mi facultad va antes que una de otra, en cualquier visita', async () => {
    _setFeedIntensityOverride(1);
    const [fing] = await getTagIds(['FING']);
    const [fmed] = await getTagIds(['FMED']);
    const otro = await registerAndLogin();
    const deFing = await createCategory(otro.cookie, { etiquetas: [fing] });
    const deFmed = await createCategory(otro.cookie, { etiquetas: [fmed] });
    const yo = await registerAndLogin({ facultad: 'FING' });
    const sinFacultad = await registerAndLogin();

    let algunaVezAlReves = false;
    for (let seed = 1; seed <= 12; seed++) {
      _setFeedSeedOverride(seed);
      const mias = await catIds(yo.cookie);
      expect(mias.indexOf(Number(deFing.id))).toBeLessThan(mias.indexOf(Number(deFmed.id)));

      const ajenas = await catIds(sinFacultad.cookie);
      if (ajenas.indexOf(Number(deFmed.id)) < ajenas.indexOf(Number(deFing.id))) algunaVezAlReves = true;
    }
    // Sin facultad cargada no hay preferencia: el orden entre ambas rota.
    expect(algunaVezAlReves).toBe(true);
  });

  test('la facultad no convierte la categoría en afín: sigue en el cupo de exploración', async () => {
    const [fing] = await getTagIds(['FING']);
    const otro = await registerAndLogin();
    const deFing = await createCategory(otro.cookie, { etiquetas: [fing] });
    const yo = await registerAndLogin({ facultad: 'FING' });

    const rows = await getRankedCategoryFeed(yo.user.id, {
      limit: 10, t0: Math.floor(Date.now() / 1000), seed: 1, p: { ...PERFIL_CHICO, J: 0 },
    });
    expect(rows.find(r => Number(r.id) === Number(deFing.id)).explora).toBe(true);
  });
});
