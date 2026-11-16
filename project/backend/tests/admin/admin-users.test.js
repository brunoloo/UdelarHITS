import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, registerVerified, createAdmin } from '../helpers.js';
import { handleGoogleAuthService, createSessionTokenService } from '../../src/services/user.service.js';

const usuarios = (cookie) => request(app).get('/api/users/').set('Cookie', cookie);
const me = (cookie) => request(app).get('/api/users/me').set('Cookie', cookie);

const ultimoAcceso = async (id) => {
  const { rows } = await pool.query('SELECT fecha_ultimo_acceso FROM usuario WHERE id = $1', [id]);
  return rows[0].fecha_ultimo_acceso;
};

const forzarAcceso = async (id, intervalo) => {
  const { rows } = await pool.query(
    `UPDATE usuario SET fecha_ultimo_acceso = NOW() - $2::interval WHERE id = $1 RETURNING fecha_ultimo_acceso`,
    [id, intervalo]
  );
  return rows[0].fecha_ultimo_acceso;
};

describe('GET /users (listado de administración)', () => {
  test('sin sesión → 401; sin rol admin → 403', async () => {
    expect((await request(app).get('/api/users/')).status).toBe(401);
    const normal = await registerAndLogin();
    expect((await usuarios(normal.cookie)).status).toBe(403);
  });

  test('cada fila trae fecha_ultimo_acceso: con fecha si hubo login, null si nunca entró', async () => {
    const admin = await createAdmin();
    await pool.query(
      `INSERT INTO usuario (nickname, nombre, email, password_hash)
       VALUES ('sin_accesos', 'sin accesos', 'sin_accesos@gmail.com', 'x')`
    );

    const res = await usuarios(admin.cookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    for (const fila of res.body.data) {
      expect(fila).toHaveProperty('fecha_ultimo_acceso');
    }

    const porNick = Object.fromEntries(res.body.data.map((u) => [u.nickname, u]));
    expect(porNick[admin.user.nickname].fecha_ultimo_acceso).not.toBeNull();
    expect(porNick.sin_accesos.fecha_ultimo_acceso).toBeNull();
  });
});

describe('registro del último acceso', () => {
  test('el alta verificada lo registra sin necesidad de login', async () => {
    const { data } = await registerVerified();
    const { rows } = await pool.query(
      'SELECT fecha_ultimo_acceso FROM usuario WHERE email = $1',
      [data.email.toLowerCase()]
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].fecha_ultimo_acceso).not.toBeNull();
  });

  test('GET /users/me actualiza una fecha vieja', async () => {
    const u = await registerAndLogin();
    await forzarAcceso(u.user.id, '2 days');

    expect((await me(u.cookie)).status).toBe(200);

    const fecha = await ultimoAcceso(u.user.id);
    expect(Date.now() - new Date(fecha).getTime()).toBeLessThan(60 * 1000);
  });

  test('GET /users/me no reescribe una fecha de hace menos de una hora', async () => {
    const u = await registerAndLogin();
    const forzada = await forzarAcceso(u.user.id, '10 minutes');

    expect((await me(u.cookie)).status).toBe(200);

    expect(new Date(await ultimoAcceso(u.user.id)).getTime()).toBe(new Date(forzada).getTime());
  });

  test('la sesión de Google lo registra', async () => {
    const user = await handleGoogleAuthService({
      emails: [{ value: 'acceso_google@gmail.com' }],
      displayName: 'Acceso Google',
    });
    expect(await ultimoAcceso(user.id)).toBeNull();

    const token = await createSessionTokenService(user.id);
    expect(typeof token).toBe('string');
    expect(await ultimoAcceso(user.id)).not.toBeNull();
  });

  test('no se expone fuera del listado de administración', async () => {
    const u = await registerAndLogin();
    const otro = await registerAndLogin();

    const propio = await me(u.cookie);
    expect(propio.status).toBe(200);
    expect(JSON.stringify(propio.body)).not.toContain('fecha_ultimo_acceso');

    const perfil = await request(app).get(`/api/users/${otro.user.nickname}`).set('Cookie', u.cookie);
    expect(perfil.status).toBe(200);
    expect(JSON.stringify(perfil.body)).not.toContain('fecha_ultimo_acceso');
  });
});
