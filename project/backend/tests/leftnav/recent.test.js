import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createTopic, createCategory, createReply } from '../helpers.js';

const idOf = (x) => x.id ?? x.contenido_id;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const recent = (qs = '') => request(app).get(`/api/topics/recent${qs}`);

describe('GET /topics/recent', () => {
  test('es público (sin sesión) → 200', async () => {
    const res = await recent();
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test('devuelve los temas del más nuevo al más viejo', async () => {
    const u = await registerAndLogin();
    const cat = await createCategory(u.cookie);
    // pausas para garantizar fecha_creacion distintas (evita empate al milisegundo)
    const t1 = await createTopic(u.cookie, { categoria_id: cat.id, titulo: 'Primero' });
    await sleep(15);
    const t2 = await createTopic(u.cookie, { categoria_id: cat.id, titulo: 'Segundo' });
    await sleep(15);
    const t3 = await createTopic(u.cookie, { categoria_id: cat.id, titulo: 'Tercero' });

    const res = await recent();
    const ids = res.body.data.map(idOf);
    // el más reciente (t3) debe venir antes que t2, y t2 antes que t1
    const pos = (t) => ids.indexOf(idOf(t));
    expect(pos(t3)).toBeLessThan(pos(t2));
    expect(pos(t2)).toBeLessThan(pos(t1));
  });

  test('un tema inactivo NO aparece en recientes', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const topic = await createTopic(a.cookie);
    // b comenta → al borrar, el tema queda inactivo
    await createReply(b.cookie, { tema_id: idOf(topic) });
    await request(app).delete(`/api/topics/${idOf(topic)}/delete`).set('Cookie', a.cookie);

    const res = await recent();
    const ids = res.body.data.map(idOf);
    expect(ids).not.toContain(idOf(topic));
  });

  test('un tema en categoría inactiva NO aparece en recientes', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const topic = await createTopic(a.cookie, { categoria_id: cat.id });  // tema activo
    // b comenta en la categoría → al borrarla queda inactiva (pero el tema sigue activo)
    await createReply(b.cookie, { categoria_id: cat.id });
    await request(app).delete(`/api/categories/${cat.id}/delete`).set('Cookie', a.cookie);

    const res = await recent();
    const ids = res.body.data.map(idOf);
    // el tema sigue activo pero su categoría no → no debe figurar
    expect(ids).not.toContain(idOf(topic));
  });

  test('respeta el límite ?limit=', async () => {
    const u = await registerAndLogin();
    const cat = await createCategory(u.cookie);
    for (let i = 0; i < 5; i++) {
      await createTopic(u.cookie, { categoria_id: cat.id, titulo: `Tema ${i}` });
    }
    const res = await recent('?limit=3');
    expect(res.body.data.length).toBeLessThanOrEqual(3);
  });
});