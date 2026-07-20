import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createCategory, createReply, getTagIds } from '../helpers.js';

// Tests del scoring por afinidad de GET /users/suggested (rama con actividad
// propia). Los casos de cold start y exclusiones básicas viven en
// users-phase3.test.js; acá validamos que las señales de afinidad ordenan.

const suggested = (cookie, qs = '') =>
  request(app).get(`/api/users/suggested${qs}`).set('Cookie', cookie);

const follow = (nickname, cookie) =>
  request(app).post(`/api/users/${nickname}/follow`).set('Cookie', cookie);

// Comentario directo en una categoría → convierte al autor en participante.
const participar = (cookie, categoriaId) =>
  createReply(cookie, { categoria_id: categoriaId });

describe('GET /users/suggested — scoring por afinidad', () => {
  test('prioriza una categoría en común (+3) sobre un usuario ajeno', async () => {
    const yo = await registerAndLogin();
    const [fing] = await getTagIds(['FING']);
    const [fder] = await getTagIds(['FDER']);

    const catMia = await createCategory(yo.cookie, { etiquetas: [fing] });
    const catAjena = await createCategory(yo.cookie, { etiquetas: [fder] });
    await participar(yo.cookie, catMia.id); // participo en catMia

    const afin = await registerAndLogin();
    await participar(afin.cookie, catMia.id); // misma categoría → +3

    const lejano = await registerAndLogin();
    await participar(lejano.cookie, catAjena.id); // categoría/etiqueta ajena → 0

    const res = await suggested(yo.cookie, '?limit=20');
    expect(res.status).toBe(200);
    const ids = res.body.data.map(u => u.id);
    expect(ids).toContain(afin.user.id);
    expect(ids).toContain(lejano.user.id);
    expect(ids.indexOf(afin.user.id)).toBeLessThan(ids.indexOf(lejano.user.id));
  });

  test('una etiqueta en común (+1) puntúa aunque la categoría sea distinta', async () => {
    const yo = await registerAndLogin();
    const [fing] = await getTagIds(['FING']);
    const [fder] = await getTagIds(['FDER']);

    const catMia = await createCategory(yo.cookie, { etiquetas: [fing] });
    const catFingAjena = await createCategory(yo.cookie, { etiquetas: [fing] });
    const catOtra = await createCategory(yo.cookie, { etiquetas: [fder] });
    await participar(yo.cookie, catMia.id); // mis etiquetas → { FING }

    const afinTag = await registerAndLogin();
    await participar(afinTag.cookie, catFingAjena.id); // otra cat, misma etiqueta → +1

    const lejano = await registerAndLogin();
    await participar(lejano.cookie, catOtra.id); // FDER → 0

    const res = await suggested(yo.cookie, '?limit=20');
    const ids = res.body.data.map(u => u.id);
    expect(ids.indexOf(afinTag.user.id)).toBeLessThan(ids.indexOf(lejano.user.id));
  });

  test('con actividad propia sigue excluyéndome a mí y a los que sigo', async () => {
    const yo = await registerAndLogin();
    const [fing] = await getTagIds(['FING']);
    const catMia = await createCategory(yo.cookie, { etiquetas: [fing] });
    await participar(yo.cookie, catMia.id); // tengo actividad → rama scoring

    const seguido = await registerAndLogin();
    await participar(seguido.cookie, catMia.id); // comparte categoría conmigo
    await follow(seguido.user.nickname, yo.cookie);

    const res = await suggested(yo.cookie, '?limit=20');
    const ids = res.body.data.map(u => u.id);
    expect(ids).not.toContain(yo.user.id);
    expect(ids).not.toContain(seguido.user.id);
  });
});
