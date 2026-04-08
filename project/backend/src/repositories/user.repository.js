import pool from '../config/db.js';

const findByEmailOrNickname = async ({ nickname, email }) => {
  const q = `
    SELECT nickname, email
    FROM usuario
    WHERE LOWER(nickname) = LOWER($1) OR LOWER(email) = LOWER($2)
  `;
  const { rows } = await pool.query(q, [nickname, email]);

  return {
    nicknameTaken: rows.some((r) => r.nickname.toLowerCase() === nickname.toLowerCase()),
    emailTaken: rows.some((r) => r.email.toLowerCase() === email.toLowerCase()),
  };
};

const findByEmailOrNicknameForLogin = async ({ nickname, email }) => {
  let q = `
    SELECT id, nickname, nombre, email, password_hash, biografia, url_imagen, estado
    FROM usuario
  `;
  const values = [];

  if (nickname && email) {
    q += ` WHERE LOWER(nickname) = LOWER($1) OR LOWER(email) = LOWER($2) LIMIT 1`;
    values.push(nickname, email);
  } else if (nickname) {
    q += ` WHERE LOWER(nickname) = LOWER($1) LIMIT 1`;
    values.push(nickname);
  } else {
    q += ` WHERE LOWER(email) = LOWER($1) LIMIT 1`;
    values.push(email);
  }

  const { rows } = await pool.query(q, values);
  return rows[0] || null;
};

const createUser = async ({ nickname, nombre, email, passwordHash, rol = 'user' }) => {
  const q = `
    INSERT INTO usuario (nickname, nombre, email, password_hash, rol)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, nickname, nombre, email, rol
  `;
  const { rows } = await pool.query(q, [nickname, nombre, email, passwordHash, rol]);
  return rows[0];
};

const getUsers = async () => {
  const q = `
    SELECT id, nickname, email
    FROM usuario
    ORDER BY id ASC
  `;
  const { rows } = await pool.query(q);
  return rows;
};

const getUserByNickname = async (nickname) => {
  const q = `
    SELECT id, rol, nickname, nombre, email, biografia, url_imagen
    FROM usuario
    WHERE LOWER(nickname) = LOWER($1)
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [nickname]);
  return rows[0] || null;
};

const getCategoriesByUserId = async (userId) => {
  const q = `
    SELECT id, titulo, descripcion, etiqueta, fecha_creacion
    FROM categoria
    WHERE autor_id = $1
    ORDER BY fecha_creacion DESC
  `;
  const { rows } = await pool.query(q, [userId]);
  return rows;
};

const getFollowersByUserId = async (userId) => {
  const q = `
    SELECT u.id, u.nickname, u.nombre, u.url_imagen
    FROM usuario_seguidor us
    JOIN usuario u ON u.id = us.seguidor_id
    WHERE us.seguido_id = $1
    ORDER BY us.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q, [userId]);
  return rows;
};

const getFollowingByUserId = async (userId) => {
  const q = `
    SELECT u.id, u.nickname, u.nombre, u.url_imagen
    FROM usuario_seguidor us
    JOIN usuario u ON u.id = us.seguido_id
    WHERE us.seguidor_id = $1
    ORDER BY us.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q, [userId]);
  return rows;
};

export { findByEmailOrNickname, createUser, findByEmailOrNicknameForLogin, getUsers, 
  getUserByNickname, getCategoriesByUserId, getFollowersByUserId, getFollowingByUserId };