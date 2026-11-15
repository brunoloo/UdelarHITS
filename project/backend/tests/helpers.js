import request from 'supertest';
import app from '../src/app.js';
import bcrypt from 'bcrypt';
import pool from '../src/config/db.js';

// Genera datos únicos para evitar colisiones de nickname/email entre tests
export const makeUser = (over = {}) => {
  const rand = Math.random().toString(36).slice(2, 8);
  return {
    nickname: 'user_' + rand,
    nombre: 'Test User',
    // Dominio permitido por el allowlist de registro (ver config/emailDomains.js).
    email: rand + '@gmail.com',
    password: 'Password123',
    ...over,
  };
};

// En test no se envía correo: el código se lee de la tabla de verificaciones.
export async function getVerificationCode(email) {
  const { rows } = await pool.query(
    `SELECT codigo FROM verificacion_registro WHERE email = $1 AND usado = FALSE ORDER BY id DESC LIMIT 1`,
    [email.trim().toLowerCase()]
  );
  return rows[0]?.codigo || null;
}

export async function registerVerified(over = {}) {
  const data = makeUser(over);

  const reg = await request(app).post('/api/auth/register').send(data);
  if (reg.status >= 400) {
    throw new Error(`register falló (${reg.status}): ${JSON.stringify(reg.body)}`);
  }

  const codigo = await getVerificationCode(data.email);
  const ver = await request(app).post('/api/auth/verify-email').send({ email: data.email, codigo });
  if (ver.status >= 400) {
    throw new Error(`verify-email falló (${ver.status}): ${JSON.stringify(ver.body)}`);
  }

  return { data, res: ver };
}

// Devuelve { user, cookie, raw }; raw conserva los datos de registro, incluida la contraseña.
export async function registerAndLogin(over = {}) {
  // El registro requiere verificación por email (dos pasos).
  const { data } = await registerVerified(over);

  const log = await request(app).post('/api/auth/login')
    .send({ email: data.email, password: data.password });
  if (log.status >= 400) {
    throw new Error(`login falló (${log.status}): ${JSON.stringify(log.body)}`);
  }

  return {
    user: log.body.data.user,
    cookie: log.headers['set-cookie'],
    raw: data,
  };
}

// El registro siempre crea rol 'user': se inserta directo en la base.
export async function createUserWithRole(rol, over = {}) {
  const data = makeUser(over);
  const hash = await bcrypt.hash(data.password, 10);
  await pool.query(
    `INSERT INTO usuario (nickname, nombre, email, password_hash, rol)
     VALUES ($1, $2, $3, $4, $5)`,
    [data.nickname, data.nombre.toLowerCase(), data.email.toLowerCase(), hash, rol]
  );
  const log = await request(app).post('/api/auth/login')
    .send({ email: data.email, password: data.password });
  if (log.status >= 400) {
    throw new Error(`login de ${rol} falló (${log.status}): ${JSON.stringify(log.body)}`);
  }
  return { user: log.body.data.user, cookie: log.headers['set-cookie'], raw: data };
}

// Atajo para admin
export const createAdmin = (over = {}) => createUserWithRole('admin', over);

// Busca IDs de etiquetas por nombre. Útil en tests que necesitan pasar IDs.
export async function getTagIds(nombres) {
  const { rows } = await pool.query('SELECT id FROM etiqueta WHERE nombre = ANY($1)', [nombres]);
  return rows.map(r => Number(r.id));
}

// Crea una categoría autenticado con la cookie dada. Devuelve el objeto categoría.
export async function createCategory(cookie, over = {}) {
  const body = {
    titulo: 'Cat ' + Math.random().toString(36).slice(2, 8),
    descripcion: 'Descripción de prueba',
    ...over,
  };
  if (!body.etiquetas) {
    body.etiquetas = await getTagIds(['Programación']);
  }
  const res = await request(app).post('/api/categories/create')
    .set('Cookie', cookie).send(body);
  if (res.status >= 400) {
    throw new Error(`createCategory falló (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
}

// Crea un tema autenticado. Si no se pasa categoria_id, crea una categoría primero.
export async function createTopic(cookie, over = {}) {
  let categoria_id = over.categoria_id;
  if (!categoria_id) {
    const cat = await createCategory(cookie);
    categoria_id = cat.id;
  }
  const body = {
    categoria_id,
    titulo: 'Tema ' + Math.random().toString(36).slice(2, 8),
    cuerpo: 'Cuerpo de prueba del tema',
    ...over,
  };
  const res = await request(app).post('/api/topics/create')
    .set('Cookie', cookie).send(body);
  if (res.status >= 400) {
    throw new Error(`createTopic falló (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
}

// Comentar en la categoría convierte al usuario en participante; sus reportes pesan más.
export async function makeParticipant(categoriaId) {
  const u = await registerAndLogin();
  const res = await request(app).post('/api/replies/create')
    .set('Cookie', u.cookie).send({ cuerpo: 'participo', categoria_id: categoriaId });
  if (res.status >= 400) {
    throw new Error(`makeParticipant falló (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return u;
}

// Por defecto cuelga de un tema, que crea si no se pasa. Para una categoría, pasar { categoria_id }.
export async function createReply(cookie, over = {}) {
  const body = { cuerpo: 'Comentario de prueba', ...over };
  if (!body.tema_id && !body.categoria_id && !over.comentario_padre_id) {
    const topic = await createTopic(cookie);
    body.tema_id = topic.id ?? topic.contenido_id;
  }
  const res = await request(app).post('/api/replies/create')
    .set('Cookie', cookie).send(body);
  if (res.status >= 400) {
    throw new Error(`createReply falló (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
}

export async function createHomeReply(cookie, over = {}) {
  const body = { cuerpo: 'Comentario de Home', es_home: true, ...over };
  const res = await request(app).post('/api/replies/create')
    .set('Cookie', cookie).send(body);
  if (res.status >= 400) {
    throw new Error(`createHomeReply falló (${res.status}): ${JSON.stringify(res.body)}`);
  }
  return res.body.data;
}