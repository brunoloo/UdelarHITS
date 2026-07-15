import request from 'supertest';
import app from '../../src/app.js';
import { registerAndLogin } from '../helpers.js';

let alice, bob, charlie;

beforeEach(async () => {
  alice = await registerAndLogin({ nickname: 'alice_chat' });
  bob = await registerAndLogin({ nickname: 'bob_chat' });
  charlie = await registerAndLogin({ nickname: 'charlie_chat' });
});

describe('GET /api/chat/conversations', () => {
  test('devuelve lista vacía al inicio', async () => {
    const res = await request(app)
      .get('/api/chat/conversations')
      .set('Cookie', alice.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  test('requiere autenticación', async () => {
    const res = await request(app).get('/api/chat/conversations');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/chat/conversations/:nickname', () => {
  test('crea conversación al buscar por nickname', async () => {
    const res = await request(app)
      .get(`/api/chat/conversations/${bob.user.nickname}`)
      .set('Cookie', alice.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.conversacion_id).toBeDefined();
    expect(res.body.data.usuario.nickname).toBe(bob.user.nickname);
  });

  test('no puede chatear con uno mismo', async () => {
    const res = await request(app)
      .get(`/api/chat/conversations/${alice.user.nickname}`)
      .set('Cookie', alice.cookie);
    expect(res.status).toBe(400);
  });

  test('404 para usuario inexistente', async () => {
    const res = await request(app)
      .get('/api/chat/conversations/noexiste999')
      .set('Cookie', alice.cookie);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/chat/conversations/:id/messages', () => {
  let convId;

  beforeEach(async () => {
    const res = await request(app)
      .get(`/api/chat/conversations/${bob.user.nickname}`)
      .set('Cookie', alice.cookie);
    convId = res.body.data.conversacion_id;
  });

  test('envía un mensaje correctamente', async () => {
    const res = await request(app)
      .post(`/api/chat/conversations/${convId}/messages`)
      .set('Cookie', alice.cookie)
      .send({ cuerpo: 'Hola Bob!' });
    expect(res.status).toBe(201);
    expect(res.body.data.cuerpo).toBe('Hola Bob!');
    expect(res.body.data.autor_id).toBe(alice.user.id);
  });

  test('400 para mensaje vacío', async () => {
    const res = await request(app)
      .post(`/api/chat/conversations/${convId}/messages`)
      .set('Cookie', alice.cookie)
      .send({ cuerpo: '' });
    expect(res.status).toBe(400);
  });

  test('400 para mensaje demasiado largo', async () => {
    const res = await request(app)
      .post(`/api/chat/conversations/${convId}/messages`)
      .set('Cookie', alice.cookie)
      .send({ cuerpo: 'x'.repeat(2001) });
    expect(res.status).toBe(400);
  });

  test('403 para usuario sin acceso', async () => {
    const res = await request(app)
      .post(`/api/chat/conversations/${convId}/messages`)
      .set('Cookie', charlie.cookie)
      .send({ cuerpo: 'intruso' });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/chat/conversations/:id/messages', () => {
  let convId;

  beforeEach(async () => {
    const res = await request(app)
      .get(`/api/chat/conversations/${bob.user.nickname}`)
      .set('Cookie', alice.cookie);
    convId = res.body.data.conversacion_id;

    for (let i = 0; i < 3; i++) {
      await request(app)
        .post(`/api/chat/conversations/${convId}/messages`)
        .set('Cookie', alice.cookie)
        .send({ cuerpo: `Mensaje ${i + 1}` });
    }
  });

  test('devuelve mensajes de la conversación', async () => {
    const res = await request(app)
      .get(`/api/chat/conversations/${convId}/messages`)
      .set('Cookie', alice.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(3);
  });

  test('soporta paginación con before', async () => {
    const all = await request(app)
      .get(`/api/chat/conversations/${convId}/messages`)
      .set('Cookie', alice.cookie);
    const lastId = all.body.data[all.body.data.length - 1].id;

    const res = await request(app)
      .get(`/api/chat/conversations/${convId}/messages?before=${lastId}`)
      .set('Cookie', alice.cookie);
    expect(res.status).toBe(200);
    res.body.data.forEach(m => expect(Number(m.id)).toBeLessThan(Number(lastId)));
  });

  test('403 para usuario sin acceso', async () => {
    const res = await request(app)
      .get(`/api/chat/conversations/${convId}/messages`)
      .set('Cookie', charlie.cookie);
    expect(res.status).toBe(403);
  });
});

describe('PATCH /api/chat/conversations/:id/read', () => {
  let convId;

  beforeEach(async () => {
    const res = await request(app)
      .get(`/api/chat/conversations/${bob.user.nickname}`)
      .set('Cookie', alice.cookie);
    convId = res.body.data.conversacion_id;

    await request(app)
      .post(`/api/chat/conversations/${convId}/messages`)
      .set('Cookie', bob.cookie)
      .send({ cuerpo: 'Mensaje sin leer' });
  });

  test('marca mensajes como leídos', async () => {
    const res = await request(app)
      .patch(`/api/chat/conversations/${convId}/read`)
      .set('Cookie', alice.cookie);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test('403 para usuario sin acceso', async () => {
    const res = await request(app)
      .patch(`/api/chat/conversations/${convId}/read`)
      .set('Cookie', charlie.cookie);
    expect(res.status).toBe(403);
  });
});

describe('conversations list', () => {
  test('muestra conversaciones con último mensaje', async () => {
    const conv = await request(app)
      .get(`/api/chat/conversations/${bob.user.nickname}`)
      .set('Cookie', alice.cookie);
    const convId = conv.body.data.conversacion_id;

    await request(app)
      .post(`/api/chat/conversations/${convId}/messages`)
      .set('Cookie', alice.cookie)
      .send({ cuerpo: 'Hola Bob!' });

    const res = await request(app)
      .get('/api/chat/conversations')
      .set('Cookie', alice.cookie);
    expect(res.status).toBe(200);
    const found = res.body.data.find(c => c.otro_nickname === bob.user.nickname);
    expect(found).toBeDefined();
    expect(found.ultimo_mensaje).toBe('Hola Bob!');
    // La lista trae los datos del otro usuario (el front pinta avatar/nombre
    // sin requests extra por conversación).
    expect(found).toHaveProperty('otro_url_imagen');
    expect(found).toHaveProperty('otro_id');
  });
});

// Abrir una conversación devuelve también la primera página de mensajes:
// el front ya no encadena un segundo request para pedirlos.
describe('mensajes incluidos al abrir la conversación', () => {
  test('devuelve los últimos mensajes junto con la conversación', async () => {
    const conv = await request(app)
      .get(`/api/chat/conversations/${bob.user.nickname}`)
      .set('Cookie', alice.cookie);
    const convId = conv.body.data.conversacion_id;
    expect(conv.body.data.mensajes).toEqual([]);

    await request(app)
      .post(`/api/chat/conversations/${convId}/messages`)
      .set('Cookie', alice.cookie)
      .send({ cuerpo: 'Hola de nuevo' });

    const reopened = await request(app)
      .get(`/api/chat/conversations/${bob.user.nickname}`)
      .set('Cookie', alice.cookie);
    expect(reopened.body.data.conversacion_id).toBe(convId);
    expect(reopened.body.data.mensajes).toHaveLength(1);
    expect(reopened.body.data.mensajes[0].cuerpo).toBe('Hola de nuevo');
  });
});

describe('GET /api/chat/unread-count', () => {
  test('requiere autenticación', async () => {
    const res = await request(app).get('/api/chat/unread-count');
    expect(res.status).toBe(401);
  });

  test('cuenta solo mensajes ajenos no leídos y se limpia al marcar leído', async () => {
    const conv = await request(app)
      .get(`/api/chat/conversations/${bob.user.nickname}`)
      .set('Cookie', alice.cookie);
    const convId = conv.body.data.conversacion_id;

    // Mensaje propio: no suma para alice.
    await request(app)
      .post(`/api/chat/conversations/${convId}/messages`)
      .set('Cookie', alice.cookie)
      .send({ cuerpo: 'mío' });

    // Dos de bob: suman 2 para alice.
    await request(app)
      .post(`/api/chat/conversations/${convId}/messages`)
      .set('Cookie', bob.cookie)
      .send({ cuerpo: 'de bob 1' });
    await request(app)
      .post(`/api/chat/conversations/${convId}/messages`)
      .set('Cookie', bob.cookie)
      .send({ cuerpo: 'de bob 2' });

    const before = await request(app)
      .get('/api/chat/unread-count')
      .set('Cookie', alice.cookie);
    expect(before.status).toBe(200);
    expect(before.body.data.total).toBe(2);

    await request(app)
      .patch(`/api/chat/conversations/${convId}/read`)
      .set('Cookie', alice.cookie);

    const after = await request(app)
      .get('/api/chat/unread-count')
      .set('Cookie', alice.cookie);
    expect(after.body.data.total).toBe(0);
  });

  test('los mensajes anteriores al borrado propio de la conversación no cuentan', async () => {
    const conv = await request(app)
      .get(`/api/chat/conversations/${bob.user.nickname}`)
      .set('Cookie', alice.cookie);
    const convId = conv.body.data.conversacion_id;

    await request(app)
      .post(`/api/chat/conversations/${convId}/messages`)
      .set('Cookie', bob.cookie)
      .send({ cuerpo: 'antes del borrado' });

    // Alice borra (soft) la conversación: lo anterior deja de ser visible para ella.
    await request(app)
      .delete(`/api/chat/conversations/${convId}`)
      .set('Cookie', alice.cookie);

    const res = await request(app)
      .get('/api/chat/unread-count')
      .set('Cookie', alice.cookie);
    expect(res.body.data.total).toBe(0);
  });
});
