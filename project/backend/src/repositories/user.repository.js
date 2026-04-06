import pool from '../config/db.js';

const findByEmailOrNickname = async ({ nickname, email }) => {
  const q = `
    SELECT id, nickname, email
    FROM usuario
    WHERE nickname = $1 OR email = $2
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [nickname, email]);
  return rows[0] || null;
};

const findByEmailOrNicknameForLogin = async ({ nickname, email }) => {
  let q = `
    SELECT id, nickname, nombre, email, password_hash, biografia, url_imagen, estado
    FROM usuario
  `;
  const values = [];

  if (nickname && email) {
    q += ` WHERE nickname = $1 OR email = $2 LIMIT 1`;
    values.push(nickname, email);
  } else if (nickname) {
    q += ` WHERE nickname = $1 LIMIT 1`;
    values.push(nickname);
  } else {
    q += ` WHERE email = $1 LIMIT 1`;
    values.push(email);
  }

  const { rows } = await pool.query(q, values);
  return rows[0] || null;
};

const createUser = async ({ nickname, nombre, email, passwordHash }) => {
  const q = `
    INSERT INTO usuario (nickname, nombre, email, password_hash)
    VALUES ($1, $2, $3, $4)
    RETURNING id, nickname, nombre, email
  `;
  const { rows } = await pool.query(q, [nickname, nombre, email, passwordHash]);
  return rows[0];
};

export { findByEmailOrNickname, createUser, findByEmailOrNicknameForLogin };