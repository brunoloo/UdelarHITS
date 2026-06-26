import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createCategory, createReply } from '../helpers.js';

const getActive = () => request(app).get('/api/categories/active').then(r => r.body.data);
const getCat = (id) => request(app).get(`/api/categories/${id}`).then(r => r.body.data);

// ─── Feature 1: ícono de categoría ───
describe('Ícono de categoría', () => {
  test('una categoría nueva tiene el ícono por defecto "grid"', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const fetched = await getCat(cat.id);
    expect(fetched.icono).toBe('grid');
  });

  test('el autor puede actualizar el ícono con un valor válido y se persiste', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);

    const res = await request(app)
      .patch(`/api/categories/${cat.id}`)
      .set('Cookie', a.cookie)
      .send({ icono: 'code' });

    expect(res.status).toBe(200);
    expect(res.body.data.icono).toBe('code');
    // Y queda persistido.
    expect((await getCat(cat.id)).icono).toBe('code');
  });

  test('un ícono fuera del set permitido → 400 y no se persiste', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);

    const res = await request(app)
      .patch(`/api/categories/${cat.id}`)
      .set('Cookie', a.cookie)
      .send({ icono: 'no-existe-este-icono' });

    expect(res.status).toBe(400);
    expect((await getCat(cat.id)).icono).toBe('grid');
  });

  test('un usuario que no es el autor no puede cambiar el ícono → 403', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const cat = await createCategory(a.cookie);

    const res = await request(app)
      .patch(`/api/categories/${cat.id}`)
      .set('Cookie', b.cookie)
      .send({ icono: 'code' });

    expect(res.status).toBe(403);
  });

  test('el ícono aparece en el feed del Home (/categories/active)', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    await request(app).patch(`/api/categories/${cat.id}`).set('Cookie', a.cookie).send({ icono: 'atom' });

    const feed = await getActive();
    const found = feed.find(c => c.id === cat.id);
    expect(found).toBeDefined();
    expect(found.icono).toBe('atom');
  });
});

// ─── Feature 2: preview del último comentario en el feed ───
describe('Último comentario directo en el feed del Home', () => {
  test('devuelve null cuando la categoría no tiene comentarios directos', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);

    const feed = await getActive();
    const found = feed.find(c => c.id === cat.id);
    expect(found).toBeDefined();
    expect(found.ultimo_comentario).toBeNull();
  });

  test('devuelve el último comentario directo con datos de autor y likes', async () => {
    const autorCat = await registerAndLogin();
    const comentarista = await registerAndLogin();
    const liker = await registerAndLogin();
    const cat = await createCategory(autorCat.cookie);

    // Dos comentarios directos: el segundo debe ser el "último".
    await createReply(comentarista.cookie, { categoria_id: cat.id, cuerpo: 'primer comentario' });
    const ultimo = await createReply(comentarista.cookie, { categoria_id: cat.id, cuerpo: 'segundo comentario' });

    // Un like al último comentario.
    await request(app)
      .post(`/api/reactions/${ultimo.contenido_id}`)
      .set('Cookie', liker.cookie)
      .send({ tipo: 'meGusta' });

    const feed = await getActive();
    const found = feed.find(c => c.id === cat.id);
    expect(found.ultimo_comentario).not.toBeNull();
    expect(Number(found.ultimo_comentario.id)).toBe(Number(ultimo.contenido_id));
    expect(found.ultimo_comentario.cuerpo).toBe('segundo comentario');
    expect(found.ultimo_comentario.autor_nickname).toBe(comentarista.user.nickname);
    expect(Number(found.ultimo_comentario.likes)).toBe(1);
    expect(found.ultimo_comentario).toHaveProperty('fecha_creacion');
    expect(found.ultimo_comentario).toHaveProperty('autor_url_imagen');
  });

  test('si hay un comentario fijado, ése es el que expone el preview (no el más reciente)', async () => {
    const autorCat = await registerAndLogin();
    const comentarista = await registerAndLogin();
    const cat = await createCategory(autorCat.cookie);

    const fijado = await createReply(comentarista.cookie, { categoria_id: cat.id, cuerpo: 'comentario a fijar' });
    // Un comentario posterior (sería el "último" por fecha si no hubiera fijado).
    await createReply(comentarista.cookie, { categoria_id: cat.id, cuerpo: 'comentario mas reciente' });

    // El creador de la categoría fija el primero.
    await request(app)
      .post(`/api/categories/${cat.id}/pin`)
      .set('Cookie', autorCat.cookie)
      .send({ tipo: 'comentario', item_id: fijado.contenido_id });

    const feed = await getActive();
    const found = feed.find(c => c.id === cat.id);
    expect(Number(found.ultimo_comentario.id)).toBe(Number(fijado.contenido_id));
    expect(found.ultimo_comentario.cuerpo).toBe('comentario a fijar');
  });

  test('una respuesta anidada no cuenta como comentario directo del preview', async () => {
    const autorCat = await registerAndLogin();
    const comentarista = await registerAndLogin();
    const cat = await createCategory(autorCat.cookie);

    const directo = await createReply(comentarista.cookie, { categoria_id: cat.id, cuerpo: 'comentario directo' });
    // Respuesta anidada al comentario directo (no es directo a la categoría).
    await createReply(comentarista.cookie, { comentario_padre_id: directo.contenido_id, cuerpo: 'respuesta anidada' });

    const feed = await getActive();
    const found = feed.find(c => c.id === cat.id);
    // El preview sigue siendo el comentario directo, no la respuesta anidada.
    expect(Number(found.ultimo_comentario.id)).toBe(Number(directo.contenido_id));
    expect(found.ultimo_comentario.cuerpo).toBe('comentario directo');
    // Y el comentario directo refleja 1 respuesta.
    expect(Number(found.ultimo_comentario.contador_respuestas)).toBe(1);
  });

  test('contador_respuestas es 0 cuando el comentario no tiene respuestas', async () => {
    const autorCat = await registerAndLogin();
    const comentarista = await registerAndLogin();
    const cat = await createCategory(autorCat.cookie);
    await createReply(comentarista.cookie, { categoria_id: cat.id, cuerpo: 'sin respuestas' });

    const feed = await getActive();
    const found = feed.find(c => c.id === cat.id);
    expect(Number(found.ultimo_comentario.contador_respuestas)).toBe(0);
  });
});
