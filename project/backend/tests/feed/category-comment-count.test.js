import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createCategory, createReply } from '../helpers.js';

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
});
