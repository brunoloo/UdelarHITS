import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createCategory, createTopic, createReply } from '../helpers.js';

const idOf = (x) => x.id ?? x.contenido_id;

// Solo cuenta los comentarios directos de la categoría, no las respuestas.
describe('CategoryCard — contador_comentarios', () => {
  test('cuenta comentarios directos de la categoría, no las respuestas anidadas', async () => {
    const u = await registerAndLogin();
    const cat = await createCategory(u.cookie);

    const c1 = await createReply(u.cookie, { categoria_id: cat.id, cuerpo: 'directo 1' });
    await createReply(u.cookie, { categoria_id: cat.id, cuerpo: 'directo 2' });
    // Respuesta anidada al primer comentario: no cuenta como comentario de la categoría.
    await createReply(u.cookie, {
      categoria_id: cat.id,
      comentario_padre_id: c1.contenido_id ?? c1.id,
      cuerpo: 'respuesta anidada',
    });

    const res = await request(app).get('/api/categories/active').set('Cookie', u.cookie);
    expect(res.status).toBe(200);
    const found = res.body.data.find(c => Number(c.id) === Number(cat.id));
    expect(found).toBeDefined();
    expect(Number(found.contador_comentarios)).toBe(2);
  });

  test('/categories/popular también expone contador_comentarios (total general)', async () => {
    const u = await registerAndLogin();
    const cat = await createCategory(u.cookie);
    const c1 = await createReply(u.cookie, { categoria_id: cat.id, cuerpo: 'directo 1' });
    await createReply(u.cookie, { categoria_id: cat.id, cuerpo: 'directo 2' });
    await createReply(u.cookie, {
      categoria_id: cat.id,
      comentario_padre_id: c1.contenido_id ?? c1.id,
      cuerpo: 'anidada',
    });

    const res = await request(app).get('/api/categories/popular?days=7&limit=20');
    expect(res.status).toBe(200);
    const found = res.body.data.find(c => Number(c.id) === Number(cat.id));
    expect(found).toBeDefined();
    expect(Number(found.contador_comentarios)).toBe(2);
  });
});

// `comentarios_directos_recientes` cuenta solo comentarios de primer nivel de la categoría;
// `comentarios_recientes` cuenta todo.
describe('/categories/popular — comentarios_directos_recientes', () => {
  test('cuenta solo comentarios de nivel 1 directos a la categoría', async () => {
    const u = await registerAndLogin();
    const cat = await createCategory(u.cookie);
    const topic = await createTopic(u.cookie, { categoria_id: cat.id });

    // 2 comentarios directos de primer nivel a la categoría.
    const c1 = await createReply(u.cookie, { categoria_id: cat.id, cuerpo: 'directo 1' });
    await createReply(u.cookie, { categoria_id: cat.id, cuerpo: 'directo 2' });
    // Respuesta anidada a un comentario directo: no cuenta.
    await createReply(u.cookie, {
      categoria_id: cat.id,
      comentario_padre_id: idOf(c1),
      cuerpo: 'respuesta anidada',
    });
    // Comentario que cuelga de un tema de la categoría: no cuenta como directo.
    await createReply(u.cookie, { tema_id: idOf(topic), cuerpo: 'comentario de tema' });

    const res = await request(app).get('/api/categories/popular?days=7&limit=20');
    expect(res.status).toBe(200);
    const found = res.body.data.find(c => Number(c.id) === Number(cat.id));
    expect(found).toBeDefined();
    // Solo los 2 directos de primer nivel.
    expect(Number(found.comentarios_directos_recientes)).toBe(2);
    // El conteo crudo sí incluye la anidada y la del tema (2 + 1 + 1).
    expect(Number(found.comentarios_recientes)).toBe(4);
  });
});
