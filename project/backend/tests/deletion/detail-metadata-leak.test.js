import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createCategory, createTopic, createReply } from '../helpers.js';

const idOf = (x) => x.id ?? x.contenido_id;

describe('data-leak: metadatos en el detalle de recursos inactivos', () => {
  test('detalle de TEMA inactivo no expone título, cuerpo, autor ni fecha', async () => {
    const autor = await registerAndLogin();
    const otro = await registerAndLogin();

    const TITULO = 'TemaDetalle_' + Math.random().toString(36).slice(2, 8);
    const CUERPO = 'CuerpoSecreto_' + Math.random().toString(36).slice(2, 8);
    const topic = await createTopic(autor.cookie, { titulo: TITULO, cuerpo: CUERPO });

    // 'otro' comenta → al borrar, el tema queda inactivo
    await createReply(otro.cookie, { tema_id: idOf(topic) });
    const del = await request(app)
      .delete(`/api/topics/${idOf(topic)}/delete`).set('Cookie', autor.cookie);
    expect(del.body.data.action).toBe('deactivated');

    // acceso por link directo al detalle
    const res = await request(app).get(`/api/topics/${idOf(topic)}`);
    expect(res.status).toBe(200);
    const t = res.body.data;

    expect(t.estado).toBe('inactivo');         // el flag SÍ viaja
    expect(t.titulo).toBeNull();
    expect(t.cuerpo).toBeNull();
    expect(t.autor_id).toBeNull();
    expect(t.autor_nickname).toBeNull();
    expect(t.fecha_creacion).not.toBeNull();
  });

  test('detalle de CATEGORÍA inactiva no expone título, descripción, autor ni fecha', async () => {
    const autor = await registerAndLogin();
    const otro = await registerAndLogin();

    const TITULO = 'CatDetalle_' + Math.random().toString(36).slice(2, 8);
    const cat = await createCategory(autor.cookie, { titulo: TITULO, descripcion: 'DescSecreta' });

    await createReply(otro.cookie, { categoria_id: cat.id });
    const del = await request(app)
      .delete(`/api/categories/${cat.id}/delete`).set('Cookie', autor.cookie);
    expect(del.body.data.action).toBe('deactivated');

    const res = await request(app).get(`/api/categories/${cat.id}`);
    expect(res.status).toBe(200);
    const c = res.body.data;

    expect(c.estado).toBe('inactiva');         // flag
    expect(c.titulo).toBeNull();
    expect(c.descripcion).toBeNull();
    expect(c.autor_id).toBeNull();
    expect(c.autor_nickname).toBeNull();
    expect(c.fecha_creacion).not.toBeNull();
  });
});