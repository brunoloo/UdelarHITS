import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createCategory, getTagIds } from '../helpers.js';

// ─── GET /api/categories/active?etiqueta= — filtro exacto por etiqueta ───
// El filtro `etiqueta` es independiente de `q`: compara por IGUALDAD sobre
// etiqueta.nombre (nunca substring), con la misma normalización (unaccent +
// lower) que el resto de las búsquedas. `q` y `etiqueta` son combinables con AND.

const getActive = (query = '') =>
  request(app).get(`/api/categories/active${query}`);

// Helper local: crea una categoría con etiquetas por nombre (no por id).
async function createWithTags(cookie, titulo, tagNames) {
  const etiquetas = await getTagIds(tagNames);
  return createCategory(cookie, { titulo, etiquetas });
}

describe('GET /categories/active — filtro ?etiqueta=', () => {
  test('?etiqueta=FING devuelve solo categorías con esa etiqueta', async () => {
    const a = await registerAndLogin();
    const conFing = await createWithTags(a.cookie, 'Cat con FING ' + Date.now(), ['FING']);
    const sinFing = await createWithTags(a.cookie, 'Cat sin FING ' + Date.now(), ['Programación']);

    const res = await getActive('?etiqueta=FING');
    expect(res.status).toBe(200);
    const ids = res.body.data.map(c => c.id);
    expect(ids).toContain(conFing.id);
    expect(ids).not.toContain(sinFing.id);
  });

  test('regresión Arquitectura: ?etiqueta=Arquitectura NO trae una categoría cuyo título contiene "Arquitectura" pero sin esa etiqueta', async () => {
    const a = await registerAndLogin();
    // Etiquetada Arquitectura (el caso legítimo, ej. FADU).
    const etiquetada = await createWithTags(a.cookie, 'FADU Arquitectura ' + Date.now(), ['Arquitectura']);
    // Título contiene "Arquitectura" pero está etiquetada FING (el falso positivo
    // que el filtro por substring de `q` metía de más).
    const soloTitulo = await createWithTags(a.cookie, 'Teorico Arquitectura de Computadoras ' + Date.now(), ['FING']);

    const res = await getActive('?etiqueta=Arquitectura');
    expect(res.status).toBe(200);
    const ids = res.body.data.map(c => c.id);
    expect(ids).toContain(etiquetada.id);
    expect(ids).not.toContain(soloTitulo.id);
  });

  test('?etiqueta=quimica (sin tilde, minúsculas) matchea "Química"', async () => {
    const a = await registerAndLogin();
    const cat = await createWithTags(a.cookie, 'Cat Quimica ' + Date.now(), ['Química']);

    const res = await getActive('?etiqueta=quimica');
    expect(res.status).toBe(200);
    const ids = res.body.data.map(c => c.id);
    expect(ids).toContain(cat.id);
  });

  test('?q= y ?etiqueta= combinados aplican AND, no OR', async () => {
    const a = await registerAndLogin();
    const fingResumen = await createWithTags(a.cookie, 'Resumen parcial FING ' + Date.now(), ['FING']);
    const fingOtro = await createWithTags(a.cookie, 'Practico FING ' + Date.now(), ['FING']);
    const otroResumen = await createWithTags(a.cookie, 'Resumen de algo ' + Date.now(), ['Programación']);

    const res = await getActive('?q=resumen&etiqueta=FING');
    expect(res.status).toBe(200);
    const ids = res.body.data.map(c => c.id);
    expect(ids).toContain(fingResumen.id);        // FING AND texto "resumen"
    expect(ids).not.toContain(fingOtro.id);       // FING pero sin "resumen"
    expect(ids).not.toContain(otroResumen.id);    // "resumen" pero no FING
  });

  test('etiqueta inexistente → 200 con lista vacía (no 500)', async () => {
    const a = await registerAndLogin();
    await createWithTags(a.cookie, 'Cualquier cat ' + Date.now(), ['FING']);

    const res = await getActive('?etiqueta=NoExisteEstaEtiquetaXYZ');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(0);
  });

  test('categorías inactivas nunca aparecen en el filtro', async () => {
    const a = await registerAndLogin();
    const cat = await createWithTags(a.cookie, 'Cat FING a borrar ' + Date.now(), ['FING']);
    // Sin contenido → el delete la elimina/desactiva; en cualquier caso sale del listado.
    await request(app).delete(`/api/categories/${cat.id}/delete`).set('Cookie', a.cookie);

    const res = await getActive('?etiqueta=FING');
    expect(res.status).toBe(200);
    const ids = res.body.data.map(c => c.id);
    expect(ids).not.toContain(cat.id);
  });

  test('sin filtros sigue devolviendo todas las categorías activas', async () => {
    const a = await registerAndLogin();
    const cat = await createWithTags(a.cookie, 'Cat sin filtro ' + Date.now(), ['FING']);

    const res = await getActive();
    expect(res.status).toBe(200);
    const ids = res.body.data.map(c => c.id);
    expect(ids).toContain(cat.id);
  });
});
