import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin, createCategory, createTopic, createReply } from '../helpers.js';

const topicId = (t) => t.id ?? t.contenido_id;
const save = (cookie, tipo, id) => request(app).post('/api/saved').set('Cookie', cookie).send({ tipo, id });
const unsave = (cookie, tipo, id) => request(app).delete(`/api/saved/${tipo}/${id}`).set('Cookie', cookie);
const ids = (cookie) => request(app).get('/api/saved/ids').set('Cookie', cookie).then(r => r.body.data);
const list = (cookie) => request(app).get('/api/saved').set('Cookie', cookie).then(r => r.body.data);

describe('Guardados', () => {
  test('guardar una categoría aparece en ids y en la lista (kind categoria)', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);

    const res = await save(a.cookie, 'categoria', cat.id);
    expect(res.status).toBe(201);

    const savedIds = await ids(a.cookie);
    expect(savedIds.categorias).toContain(Number(cat.id));

    const items = await list(a.cookie);
    const found = items.find(i => i.kind === 'categoria' && Number(i.id) === Number(cat.id));
    expect(found).toBeDefined();
    expect(found.titulo).toBe(cat.titulo);
    expect(found).toHaveProperty('icono');
    expect(found).toHaveProperty('contador_temas');
  });

  test('guardar un tema expone cuerpo y contador_comentarios (kind tema)', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const topic = await createTopic(a.cookie, { categoria_id: cat.id, cuerpo: 'cuerpo guardado' });
    await createReply(a.cookie, { tema_id: topicId(topic), cuerpo: 'un comentario' });

    await save(a.cookie, 'tema', topicId(topic));

    const savedIds = await ids(a.cookie);
    expect(savedIds.temas).toContain(Number(topicId(topic)));

    const items = await list(a.cookie);
    const found = items.find(i => i.kind === 'tema' && Number(i.id) === Number(topicId(topic)));
    expect(found.cuerpo).toBe('cuerpo guardado');
    expect(Number(found.contador_comentarios)).toBe(1);
    expect(found.categoria_titulo).toBe(cat.titulo);
  });

  test('guardar un comentario trae la forma de CommentCard (kind comentario)', async () => {
    const a = await registerAndLogin();
    const topic = await createTopic(a.cookie);
    const comment = await createReply(a.cookie, { tema_id: topicId(topic), cuerpo: 'comentario guardado' });

    await save(a.cookie, 'comentario', comment.contenido_id);

    const savedIds = await ids(a.cookie);
    expect(savedIds.comentarios).toContain(Number(comment.contenido_id));

    const items = await list(a.cookie);
    const found = items.find(i => i.kind === 'comentario' && Number(i.id) === Number(comment.contenido_id));
    expect(found.cuerpo).toBe('comentario guardado');
    expect(found.tipo).toBe('tema');
    expect(Number(found.destino_id)).toBe(Number(topicId(topic)));
    expect(found).toHaveProperty('likes');
    expect(found).toHaveProperty('autor_nickname');
  });

  test('quitar de guardados lo saca de ids y de la lista', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    await save(a.cookie, 'categoria', cat.id);

    const res = await unsave(a.cookie, 'categoria', cat.id);
    expect(res.status).toBe(200);

    const savedIds = await ids(a.cookie);
    expect(savedIds.categorias).not.toContain(Number(cat.id));
    const items = await list(a.cookie);
    expect(items.find(i => i.kind === 'categoria' && Number(i.id) === Number(cat.id))).toBeUndefined();
  });

  test('guardar dos veces es idempotente (no duplica)', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    await save(a.cookie, 'categoria', cat.id);
    await save(a.cookie, 'categoria', cat.id);

    const items = await list(a.cookie);
    const matches = items.filter(i => i.kind === 'categoria' && Number(i.id) === Number(cat.id));
    expect(matches).toHaveLength(1);
  });

  test('los guardados son por usuario (no se ven los de otro)', async () => {
    const a = await registerAndLogin();
    const b = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    await save(a.cookie, 'categoria', cat.id);

    const savedB = await ids(b.cookie);
    expect(savedB.categorias).not.toContain(Number(cat.id));
  });

  test('la lista mezcla tipos ordenados por fecha de guardado (más reciente primero)', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const topic = await createTopic(a.cookie, { categoria_id: cat.id });
    const comment = await createReply(a.cookie, { tema_id: topicId(topic), cuerpo: 'c' });

    await save(a.cookie, 'categoria', cat.id);
    await save(a.cookie, 'tema', topicId(topic));
    await save(a.cookie, 'comentario', comment.contenido_id);

    const items = await list(a.cookie);
    expect(items.length).toBe(3);
    // El último guardado (comentario) va primero.
    expect(items[0].kind).toBe('comentario');
  });

  test('tipo inválido → 400', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const res = await save(a.cookie, 'usuario', cat.id);
    expect(res.status).toBe(400);
  });

  test('requiere sesión → 401', async () => {
    const res = await request(app).get('/api/saved/ids');
    expect(res.status).toBe(401);
  });
});
