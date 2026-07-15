import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createCategory, createReply } from '../helpers.js';

// ─── GET /api/categories/index — índice liviano de categorías activas ───
// Es la versión para buscador/sidebar/listados: misma información básica que
// /categories/active (título, descripción, contadores, etiquetas, autor) pero
// SIN las previews de último tema / último comentario, que son lo caro.

const getIndex = () => request(app).get('/api/categories/index');

describe('GET /categories/index', () => {
  test('es público y devuelve la categoría con los campos del índice', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie, { descripcion: 'Una descripción visible' });

    const res = await getIndex();
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const found = res.body.data.find(c => c.id === cat.id);
    expect(found).toBeDefined();
    expect(found.titulo).toBe(cat.titulo);
    expect(found.descripcion).toBe('Una descripción visible');
    expect(found.icono).toBe('grid');
    expect(found.autor_nickname).toBe(a.user.nickname);
    expect(Array.isArray(found.etiquetas)).toBe(true);
    expect(found.etiquetas).toContain('Programación');
    expect(found.fecha_creacion).toBeDefined();
  });

  test('no incluye las previews pesadas de la card del Home', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    await createReply(a.cookie, { categoria_id: cat.id, cuerpo: 'comentario directo' });

    const res = await getIndex();
    const found = res.body.data.find(c => c.id === cat.id);
    expect(found).toBeDefined();
    // La forma liviana no arrastra los JSON de preview (eso es de /active).
    expect(found).not.toHaveProperty('ultimo_comentario');
    expect(found).not.toHaveProperty('ultimo_tema');
  });

  test('cuenta solo comentarios directos (top-level) de la categoría', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const directo = await createReply(a.cookie, { categoria_id: cat.id, cuerpo: 'directo' });
    // Una respuesta anidada no debe sumar al contador top-level.
    await createReply(a.cookie, { comentario_padre_id: directo.contenido_id, cuerpo: 'respuesta' });

    const res = await getIndex();
    const found = res.body.data.find(c => c.id === cat.id);
    expect(Number(found.contador_comentarios)).toBe(1);
  });

  test('no lista categorías inactivas', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    // Sin contenido → el delete la elimina/desactiva; en cualquier caso sale del índice.
    await request(app).delete(`/api/categories/${cat.id}/delete`).set('Cookie', a.cookie);

    const res = await getIndex();
    expect(res.body.data.find(c => c.id === cat.id)).toBeUndefined();
  });
});
