import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createCategory, createTopic, createReply } from '../helpers.js';

const idOf = (x) => x.id ?? x.contenido_id;

// La CategoryCard del Home expone contador_comentarios junto a contador_temas.
// Debe contar SOLO los comentarios directos (top-level) de la categoría — el
// mismo criterio que el tab "Comentarios" de la página —, no las respuestas
// anidadas.
describe('CategoryCard — contador_comentarios', () => {
  test('cuenta comentarios directos de la categoría, no las respuestas anidadas', async () => {
    const u = await registerAndLogin();
    const cat = await createCategory(u.cookie);

    const c1 = await createReply(u.cookie, { categoria_id: cat.id, cuerpo: 'directo 1' });
    await createReply(u.cookie, { categoria_id: cat.id, cuerpo: 'directo 2' });
    // Respuesta anidada al primer comentario: NO cuenta como comentario de la categoría.
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

// El card "Categoría de la semana" (hero de Explorar) y la card de Populares
// exponen `comentarios_directos_recientes`: SOLO los comentarios de primer nivel
// directos a la categoría dentro de la ventana — no las respuestas anidadas ni
// los comentarios que cuelgan de temas. El conteo crudo `comentarios_recientes`
// (que alimenta el ranking y la presencia) sí cuenta todo.
describe('/categories/popular — comentarios_directos_recientes', () => {
  test('cuenta solo comentarios de nivel 1 directos a la categoría', async () => {
    const u = await registerAndLogin();
    const cat = await createCategory(u.cookie);
    const topic = await createTopic(u.cookie, { categoria_id: cat.id });

    // 2 comentarios directos de primer nivel a la categoría.
    const c1 = await createReply(u.cookie, { categoria_id: cat.id, cuerpo: 'directo 1' });
    await createReply(u.cookie, { categoria_id: cat.id, cuerpo: 'directo 2' });
    // Respuesta anidada a un comentario directo: NO cuenta.
    await createReply(u.cookie, {
      categoria_id: cat.id,
      comentario_padre_id: idOf(c1),
      cuerpo: 'respuesta anidada',
    });
    // Comentario que cuelga de un tema de la categoría: NO cuenta como directo.
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
