import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin } from '../helpers.js';

// GET /api/users/mentions — candidatos para el autocompletado de @menciones.
// q vacío → hasta 5 usuarios al azar; q con texto → nickname que EMPIEZA con q
// (solo nickname, no nombre). Excluye al viewer, bloqueos y no-activos.

// Inserta un usuario directo en la BD (más rápido que registrar por la API cuando
// solo necesitamos que exista como candidato).
async function insertUser(nickname, { nombre = 'test user', estado = 'activo' } = {}) {
  const rand = Math.random().toString(36).slice(2, 8);
  const { rows } = await pool.query(
    `INSERT INTO usuario (nickname, nombre, email, password_hash, rol, estado)
     VALUES ($1, $2, $3, 'x', 'user', $4)
     RETURNING id, nickname`,
    [nickname, nombre, `${nickname.toLowerCase()}_${rand}@gmail.com`, estado]
  );
  return rows[0];
}

const nicks = (res) => res.body.data.map((u) => u.nickname);

describe('GET /api/users/mentions', () => {
  test('q vacío o ausente → exactamente 5 usuarios activos', async () => {
    const viewer = await registerAndLogin({ nickname: 'viewer' });
    for (let i = 0; i < 8; i++) await insertUser(`activo${i}`);
    await insertUser('inactivo1', { estado: 'inactivo' });
    await insertUser('baneado1', { estado: 'ban' });

    for (const url of ['/api/users/mentions', '/api/users/mentions?q=']) {
      const res = await request(app).get(url).set('Cookie', viewer.cookie);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.data).toHaveLength(5);
      for (const u of res.body.data) {
        expect(u).toHaveProperty('id');
        expect(u).toEqual(expect.objectContaining({ nickname: expect.any(String) }));
        expect(u).toHaveProperty('nombre');
        expect(u).toHaveProperty('url_imagen');
      }
      const ids = res.body.data.map((u) => u.id);
      const { rows } = await pool.query(`SELECT estado FROM usuario WHERE id = ANY($1)`, [ids]);
      expect(rows.every((r) => r.estado === 'activo')).toBe(true);
    }
  });

  test('no incluye al propio viewer (q vacío ni con su prefijo)', async () => {
    const viewer = await registerAndLogin({ nickname: 'zeta_viewer' });
    await insertUser('zeta_otro');
    await insertUser('otro1');

    let res = await request(app).get('/api/users/mentions?q=').set('Cookie', viewer.cookie);
    expect(res.status).toBe(200);
    expect(nicks(res)).not.toContain('zeta_viewer');

    res = await request(app).get('/api/users/mentions?q=zeta').set('Cookie', viewer.cookie);
    expect(nicks(res)).toEqual(['zeta_otro']);
  });

  test('excluye bloqueados en ambos sentidos', async () => {
    const alice = await registerAndLogin({ nickname: 'blk_alice' });
    const bob = await registerAndLogin({ nickname: 'blk_bob' });
    const carol = await registerAndLogin({ nickname: 'blk_carol' });
    await insertUser('blk_dave');

    // alice bloquea a bob; carol bloquea a alice
    expect((await request(app).post('/api/users/blk_bob/block').set('Cookie', alice.cookie)).status).toBe(200);
    expect((await request(app).post('/api/users/blk_alice/block').set('Cookie', carol.cookie)).status).toBe(200);

    const res = await request(app).get('/api/users/mentions?q=blk').set('Cookie', alice.cookie);
    expect(res.status).toBe(200);
    expect(nicks(res)).toEqual(['blk_dave']);

    // bob tampoco ve a alice (bloqueo en el otro sentido)
    const resBob = await request(app).get('/api/users/mentions?q=blk').set('Cookie', bob.cookie);
    expect(nicks(resBob)).not.toContain('blk_alice');
    expect(nicks(resBob)).toEqual(expect.arrayContaining(['blk_carol', 'blk_dave']));
  });

  test('excluye cuentas desactivadas', async () => {
    const viewer = await registerAndLogin({ nickname: 'des_viewer' });
    const victim = await registerAndLogin({ nickname: 'des_victim' });
    await insertUser('des_ok');

    const deact = await request(app)
      .post('/api/users/me/deactivate')
      .set('Cookie', victim.cookie)
      .send({ password: victim.raw.password });
    expect(deact.status).toBe(200);

    const res = await request(app).get('/api/users/mentions?q=des').set('Cookie', viewer.cookie);
    expect(nicks(res)).toEqual(['des_ok']);
  });

  test('q=an matchea por prefijo de nickname, no por contiene ni por nombre', async () => {
    await insertUser('ana');
    await insertUser('andres');
    await insertUser('juan');
    await insertUser('pepe', { nombre: 'ana' });

    const res = await request(app).get('/api/users/mentions?q=an');
    expect(res.status).toBe(200);
    expect(nicks(res)).toEqual(['ana', 'andres']);

    // coincidencia exacta achica hasta 1
    const exact = await request(app).get('/api/users/mentions?q=andres');
    expect(nicks(exact)).toEqual(['andres']);

    // case-insensitive
    const upper = await request(app).get('/api/users/mentions?q=AN');
    expect(nicks(upper)).toEqual(['ana', 'andres']);
  });

  test('`_` se trata literal (escape de comodines LIKE)', async () => {
    await insertUser('a_b');
    await insertUser('axb');

    const res = await request(app).get('/api/users/mentions?q=a_');
    expect(nicks(res)).toEqual(['a_b']);
  });

  test('q > 30 caracteres o con caracteres inválidos → 200 []', async () => {
    await insertUser('valido');
    for (const q of ['a'.repeat(31), '%', 'va%', "v'or", 'v l', 'va\\']) {
      const res = await request(app).get(`/api/users/mentions?q=${encodeURIComponent(q)}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    }
  });

  test('invitado sin cookie → 200', async () => {
    await insertUser('guestvisible');
    const res = await request(app).get('/api/users/mentions?q=guest');
    expect(res.status).toBe(200);
    expect(nicks(res)).toEqual(['guestvisible']);
  });
});
