import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createCategory, createTopic } from '../helpers.js';

// El id resuelve el recurso y el slug es decorativo: las URLs sin slug o con slug viejo
// redirigen al canónico.

describe('Slugs y redirect 301', () => {
  test('URL sin slug redirige 301 al canónico con slug', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie, {
      titulo: 'Álgebra Lineal',
      descripcion: 'Curso de álgebra',
    });

    const res = await request(app).get(`/category/${cat.id}`);
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe(`/category/${cat.id}-algebra-lineal`);
  });

  test('slug incorrecto (título editado) redirige 301 al canónico', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie, {
      titulo: 'Bases de Datos',
      descripcion: 'FBD',
    });

    const res = await request(app).get(`/category/${cat.id}-slug-viejo-incorrecto`);
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe(`/category/${cat.id}-bases-de-datos`);
  });

  test('slug correcto responde 200 sin redirigir', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie, {
      titulo: 'Redes de Computadoras',
      descripcion: 'Curso',
    });

    const res = await request(app).get(`/category/${cat.id}-redes-de-computadoras`);
    expect(res.status).toBe(200);
  });

  test('preserva el querystring al redirigir', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie, {
      titulo: 'Sistemas Operativos',
      descripcion: 'SO',
    });

    const res = await request(app).get(`/category/${cat.id}?tab=temas`);
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe(`/category/${cat.id}-sistemas-operativos?tab=temas`);
  });

  test('temas: URL sin slug redirige 301 al canónico', async () => {
    const a = await registerAndLogin();
    const topic = await createTopic(a.cookie, { titulo: 'Como aprobar el examen' });
    const id = topic.id ?? topic.contenido_id;

    const res = await request(app).get(`/topic/${id}`);
    expect(res.status).toBe(301);
    expect(res.headers.location).toBe(`/topic/${id}-como-aprobar-el-examen`);
  });

  test('no redirige contenido inactivo (sirve noindex directo)', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    await pool.query(`UPDATE categoria SET estado = 'inactiva' WHERE id = $1`, [cat.id]);

    const res = await request(app).get(`/category/${cat.id}`);
    expect(res.status).toBe(200);
  });
});
