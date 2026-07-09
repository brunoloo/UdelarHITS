// Defensa 3: retención de mensajes de chat (30 días) y consistencia de la
// conversación cuando la purga la deja vacía.
import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin } from '../helpers.js';
import { purgeOldChatMessages, purgeExpiredAuthRows } from '../../src/jobs/cleanup.job.js';

const abrir = (cookie, nickname) =>
  request(app).get(`/api/chat/conversations/${nickname}`).set('Cookie', cookie);

const enviar = (cookie, convId, cuerpo) =>
  request(app).post(`/api/chat/conversations/${convId}/messages`).set('Cookie', cookie).send({ cuerpo });

// Backdatea un mensaje N días para simular antigüedad.
const envejecer = (msgId, dias) =>
  pool.query(`UPDATE mensaje SET fecha_creacion = NOW() - make_interval(days => $2) WHERE id = $1`, [msgId, dias]);

let a, b, convId;

beforeEach(async () => {
  a = await registerAndLogin();
  b = await registerAndLogin();
  const conv = await abrir(a.cookie, b.user.nickname);
  convId = conv.body.data.conversacion_id;
});

describe('retención de mensajes de chat (30 días)', () => {
  test('borra los mensajes de +30 días y conserva los de -30', async () => {
    const viejo = await enviar(a.cookie, convId, 'mensaje viejo');
    const reciente = await enviar(b.cookie, convId, 'mensaje reciente');
    await envejecer(viejo.body.data.id, 31);
    await envejecer(reciente.body.data.id, 29);

    const purgados = await purgeOldChatMessages(30);
    expect(purgados).toBe(1);

    const { rows } = await pool.query('SELECT id FROM mensaje WHERE conversacion_id = $1', [convId]);
    expect(rows.map(r => r.id)).toEqual([reciente.body.data.id]);
  });

  test('una conversación que queda sin mensajes sigue siendo consistente', async () => {
    const unico = await enviar(a.cookie, convId, 'esto se va a purgar');
    await envejecer(unico.body.data.id, 40);
    await purgeOldChatMessages(30);

    // El listado de conversaciones no crashea (la conversación puede aparecer
    // con preview vacío, pero la respuesta es 200 y bien formada).
    const lista = await request(app).get('/api/chat/conversations').set('Cookie', a.cookie);
    expect(lista.status).toBe(200);
    expect(Array.isArray(lista.body.data)).toBe(true);

    // Abrir la conversación devuelve el historial vacío, sin error.
    const msgs = await request(app)
      .get(`/api/chat/conversations/${convId}/messages`)
      .set('Cookie', a.cookie);
    expect(msgs.status).toBe(200);
    expect(msgs.body.data).toEqual([]);

    // Y se puede seguir chateando en ella.
    const nuevo = await enviar(b.cookie, convId, 'seguimos acá');
    expect(nuevo.status).toBe(201);
  });
});

describe('housekeeping de auth (tokens y verificaciones vencidas)', () => {
  test('purga tokens de reset usados o vencidos y conserva los vigentes', async () => {
    // Un token vigente, uno usado y uno vencido (con más de 1 día de gracia).
    await pool.query(
      `INSERT INTO token_reset_password (usuario_id, token, expira_en, usado) VALUES
       ($1, 'tok_vigente', NOW() + interval '10 minutes', FALSE),
       ($1, 'tok_usado',   NOW() + interval '10 minutes', TRUE),
       ($1, 'tok_vencido', NOW() - interval '2 days',     FALSE)`,
      [a.user.id]
    );
    const res = await purgeExpiredAuthRows();
    expect(res.tokens).toBe(2);
    const { rows } = await pool.query('SELECT token FROM token_reset_password WHERE usuario_id = $1', [a.user.id]);
    expect(rows.map(r => r.token)).toEqual(['tok_vigente']);
  });
});
