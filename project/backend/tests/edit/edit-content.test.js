import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createTopic, createCategory, createReply } from '../helpers.js';

const idOf = (x) => x.id ?? x.contenido_id;

const cuerpoEnBD = async (id) => {
  const { rows } = await pool.query('SELECT cuerpo FROM contenido WHERE id = $1', [id]);
  return rows[0]?.cuerpo ?? null;
};

describe('edición de comentario persiste en la BD', () => {
  test('editar el cuerpo de un comentario cambia el dato real', async () => {
    const u = await registerAndLogin();
    const reply = await createReply(u.cookie);
    const rid = idOf(reply);

    const NUEVO = 'Cuerpo editado ' + Math.random().toString(36).slice(2, 6);
    const res = await request(app)
      .patch(`/api/replies/update/${rid}`)
      .set('Cookie', u.cookie)
      .send({ cuerpo: NUEVO });
    expect(res.status).toBe(200);

    // el cambio se persistió de verdad
    expect(await cuerpoEnBD(rid)).toBe(NUEVO);
  });
});

describe('edición de tema persiste en la BD', () => {
  test('editar el cuerpo de un tema cambia el dato real', async () => {
    const u = await registerAndLogin();
    const topic = await createTopic(u.cookie);
    const tid = idOf(topic);

    const NUEVO = 'Cuerpo de tema editado ' + Math.random().toString(36).slice(2, 6);
    const res = await request(app)
      .patch(`/api/topics/${tid}`)
      .set('Cookie', u.cookie)
      .send({ cuerpo: NUEVO });
    expect(res.status).toBe(200);

    expect(await cuerpoEnBD(tid)).toBe(NUEVO);
  });
});

describe('edición de categoría persiste en la BD', () => {
  const descripcionEnBD = async (id) => {
    const { rows } = await pool.query('SELECT descripcion FROM categoria WHERE id = $1', [id]);
    return rows[0]?.descripcion ?? null;
  };
  const etiquetasEnBD = async (id) => {
    const { rows } = await pool.query(
      'SELECT etiqueta_valor FROM categoria_etiqueta WHERE categoria_id = $1 ORDER BY etiqueta_valor', [id]
    );
    return rows.map(r => r.etiqueta_valor);
  };

  test('editar la descripción cambia el dato real', async () => {
    const u = await registerAndLogin();
    const cat = await createCategory(u.cookie);

    const NUEVA = 'Descripción editada ' + Math.random().toString(36).slice(2, 6);
    const res = await request(app)
      .patch(`/api/categories/${cat.id}`)
      .set('Cookie', u.cookie)
      .send({ descripcion: NUEVA });
    expect(res.status).toBe(200);
    expect(await descripcionEnBD(cat.id)).toBe(NUEVA);
  });

  test('editar etiquetas reemplaza el set completo en categoria_etiqueta', async () => {
    const u = await registerAndLogin();
    // se crea con ['Programación'] por defecto en el helper
    const cat = await createCategory(u.cookie);
    expect(await etiquetasEnBD(cat.id)).toEqual(['Programación']);

    // editar a un set nuevo
    const res = await request(app)
      .patch(`/api/categories/${cat.id}`)
      .set('Cookie', u.cookie)
      .send({ etiquetas: ['Ciencia', 'Matemática'] });
    expect(res.status).toBe(200);

    // las viejas se borraron, quedan solo las nuevas (ordenadas alfabéticamente por el query)
    expect(await etiquetasEnBD(cat.id)).toEqual(['Ciencia', 'Matemática']);
  });
});

describe('edición no toca lo que no debe (no-efecto)', () => {
  const temaEnBD = async (id) => {
    const { rows } = await pool.query(
      'SELECT titulo, estado, categoria_id FROM tema WHERE contenido_id = $1', [id]
    );
    return rows[0];
  };
  const catEnBD = async (id) => {
    const { rows } = await pool.query(
      'SELECT titulo, descripcion, autor_id FROM categoria WHERE id = $1', [id]
    );
    return rows[0];
  };
  const etiquetasDe = async (id) => {
    const { rows } = await pool.query(
      'SELECT etiqueta_valor FROM categoria_etiqueta WHERE categoria_id = $1 ORDER BY etiqueta_valor', [id]
    );
    return rows.map(r => r.etiqueta_valor);
  };

  test('editar el cuerpo de un tema NO cambia su título, estado ni categoría', async () => {
    const u = await registerAndLogin();
    const topic = await createTopic(u.cookie);
    const tid = idOf(topic);
    const antes = await temaEnBD(tid);

    await request(app).patch(`/api/topics/${tid}`)
      .set('Cookie', u.cookie).send({ cuerpo: 'nuevo cuerpo' });

    const despues = await temaEnBD(tid);
    expect(despues.titulo).toBe(antes.titulo);
    expect(despues.estado).toBe(antes.estado);
    expect(despues.categoria_id).toBe(antes.categoria_id);
  });

  test('editar SOLO la descripción de una categoría deja las etiquetas intactas', async () => {
    const u = await registerAndLogin();
    const cat = await createCategory(u.cookie);  // etiquetas: ['Programación']
    const etiquetasAntes = await etiquetasDe(cat.id);

    await request(app).patch(`/api/categories/${cat.id}`)
      .set('Cookie', u.cookie).send({ descripcion: 'solo cambio descripción' });

    expect(await etiquetasDe(cat.id)).toEqual(etiquetasAntes);  // sin tocar
  });

  test('editar SOLO las etiquetas de una categoría deja la descripción intacta', async () => {
    const u = await registerAndLogin();
    const cat = await createCategory(u.cookie);
    const antes = await catEnBD(cat.id);

    await request(app).patch(`/api/categories/${cat.id}`)
      .set('Cookie', u.cookie).send({ etiquetas: ['Ciencia'] });

    const despues = await catEnBD(cat.id);
    expect(despues.descripcion).toBe(antes.descripcion);  // sin tocar
  });

  test('editar una categoría NO cambia su título ni su autor', async () => {
    const u = await registerAndLogin();
    const cat = await createCategory(u.cookie);
    const antes = await catEnBD(cat.id);

    await request(app).patch(`/api/categories/${cat.id}`)
      .set('Cookie', u.cookie).send({ descripcion: 'cambio' });

    const despues = await catEnBD(cat.id);
    expect(despues.titulo).toBe(antes.titulo);
    expect(despues.autor_id).toBe(antes.autor_id);
  });
});