import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createCategory, createTopic, createReply } from '../helpers.js';

const topicId = (t) => t.id ?? t.contenido_id;
const setInactivo = (userId) => pool.query(`UPDATE usuario SET estado = 'inactivo' WHERE id = $1`, [userId]);
const setBan = (userId) => pool.query(`UPDATE usuario SET estado = 'ban' WHERE id = $1`, [userId]);

// Las queries deben exponer el estado del usuario relevante para que el frontend
// pueda anonimizar SOLO las cuentas inactivas (las 'ban' siguen públicas).
describe('Anonimización de cuentas inactivas — datos del backend', () => {
  test('categories/active expone autor_estado del creador', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);

    await setInactivo(a.user.id);
    const feed = await request(app).get('/api/categories/active').then(r => r.body.data);
    const found = feed.find(c => c.id === cat.id);
    expect(found).toBeDefined();
    expect(found.autor_estado).toBe('inactivo');
    expect(found.autor_nickname).toBe(a.user.nickname);
  });

  test('replies/user expone padre_autor_estado del autor del comentario padre', async () => {
    const padreAutor = await registerAndLogin();
    const respondedor = await registerAndLogin();
    const topic = await createTopic(padreAutor.cookie);
    const padre = await createReply(padreAutor.cookie, { tema_id: topicId(topic), cuerpo: 'comentario padre' });
    const respuesta = await createReply(respondedor.cookie, {
      comentario_padre_id: padre.contenido_id, tema_id: topicId(topic), cuerpo: 'respuesta',
    });

    await setInactivo(padreAutor.user.id);
    const res = await request(app).get(`/api/replies/user/${respondedor.user.id}`).set('Cookie', respondedor.cookie);
    const r = res.body.data.find(x => Number(x.id) === Number(respuesta.contenido_id));
    expect(r.padre_autor_estado).toBe('inactivo');
  });

  test('notifications expone actor_estado del actor', async () => {
    const seguido = await registerAndLogin();
    const seguidor = await registerAndLogin();
    await request(app).post(`/api/users/${seguido.user.nickname}/follow`).set('Cookie', seguidor.cookie);

    await setInactivo(seguidor.user.id);
    const res = await request(app).get('/api/notifications').set('Cookie', seguido.cookie);
    const notif = res.body.data.find(n => n.actor_nickname === seguidor.user.nickname);
    expect(notif).toBeDefined();
    expect(notif.actor_estado).toBe('inactivo');
  });

  test('una cuenta ban NO se marca como inactiva (sigue pública)', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);

    await setBan(a.user.id);
    const feed = await request(app).get('/api/categories/active').then(r => r.body.data);
    const found = feed.find(c => c.id === cat.id);
    expect(found.autor_estado).toBe('ban');
    expect(found.autor_estado).not.toBe('inactivo');
  });
});
