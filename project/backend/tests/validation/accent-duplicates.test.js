import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createCategory, getTagIds } from '../helpers.js';

let tagIds;
beforeAll(async () => {
  tagIds = await getTagIds(['Programación']);
});

const crearCat = (cookie, titulo) =>
  request(app).post('/api/categories/create').set('Cookie', cookie)
    .send({ titulo, descripcion: 'desc', etiquetas: tagIds });

const crearTema = (cookie, categoria_id, titulo) =>
  request(app).post('/api/topics/create').set('Cookie', cookie)
    .send({ categoria_id, titulo, cuerpo: 'cuerpo' });

describe('duplicados ignorando tildes', () => {
  test('categoría: "Cálculo" y "Calculo" colisionan → 409', async () => {
    const u = await registerAndLogin();
    const sufijo = Math.random().toString(36).slice(2, 6);
    const conTilde = await crearCat(u.cookie, `Cálculo ${sufijo}`);
    expect(conTilde.status).toBe(201);
    const sinTilde = await crearCat(u.cookie, `Calculo ${sufijo}`);
    expect(sinTilde.status).toBe(409);
  });

  test('categoría: el título se guarda CON la tilde original', async () => {
    const u = await registerAndLogin();
    const sufijo = Math.random().toString(36).slice(2, 6);
    const TITULO = `Físíca ${sufijo}`;
    const res = await crearCat(u.cookie, TITULO);
    expect(res.status).toBe(201);
    expect(res.body.data.titulo).toContain('í');
  });

  test('tema: "Análisis" y "Analisis" en la misma categoría colisionan → 409', async () => {
    const u = await registerAndLogin();
    const cat = await createCategory(u.cookie);
    const sufijo = Math.random().toString(36).slice(2, 6);
    const conTilde = await crearTema(u.cookie, cat.id, `Análisis ${sufijo}`);
    expect(conTilde.status).toBe(201);
    const sinTilde = await crearTema(u.cookie, cat.id, `Analisis ${sufijo}`);
    expect(sinTilde.status).toBe(409);
  });

  test('categoría: "hola mundo" y "hola      mundo" colisionan → 409', async () => {
    const u = await registerAndLogin();
    const sufijo = Math.random().toString(36).slice(2, 6);
    const normal = await crearCat(u.cookie, `hola mundo ${sufijo}`);
    expect(normal.status).toBe(201);
    const espaciado = await crearCat(u.cookie, `hola      mundo ${sufijo}`);
    expect(espaciado.status).toBe(409);
  });

  test('categoría: espacios al inicio/fin no crean un título distinto → 409', async () => {
    const u = await registerAndLogin();
    const sufijo = Math.random().toString(36).slice(2, 6);
    const TITULO = `Derecho ${sufijo}`;
    await crearCat(u.cookie, TITULO);
    const res = await crearCat(u.cookie, `   ${TITULO}   `);
    expect(res.status).toBe(409);
  });
});
