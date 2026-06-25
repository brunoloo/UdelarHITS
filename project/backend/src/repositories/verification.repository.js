import pool from '../config/db.js';

// Crea una verificación de registro pendiente. Invalida las anteriores del mismo
// email para que solo el último código enviado sea válido.
export const createVerification = async ({ email, codigo, nickname, nombre, passwordHash, expiraEn }) => {
  await pool.query(
    `UPDATE verificacion_registro SET usado = TRUE WHERE email = $1 AND usado = FALSE`,
    [email]
  );

  const q = `
    INSERT INTO verificacion_registro (email, codigo, nickname, nombre, password_hash, expira_en)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, email, expira_en
  `;
  const { rows } = await pool.query(q, [email, codigo, nickname, nombre, passwordHash, expiraEn]);
  return rows[0];
};

// Devuelve la verificación pendiente vigente (no usada, no expirada) de un email.
export const findValidVerification = async (email) => {
  const q = `
    SELECT id, email, codigo, nickname, nombre, password_hash, intentos, expira_en
    FROM verificacion_registro
    WHERE email = $1 AND usado = FALSE AND expira_en > NOW()
    ORDER BY id DESC
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [email]);
  return rows[0] || null;
};

export const incrementVerificationAttempts = async (id) => {
  const { rows } = await pool.query(
    `UPDATE verificacion_registro SET intentos = intentos + 1 WHERE id = $1 RETURNING intentos`,
    [id]
  );
  return rows[0]?.intentos ?? 0;
};

export const markVerificationUsed = async (id) => {
  await pool.query(`UPDATE verificacion_registro SET usado = TRUE WHERE id = $1`, [id]);
};
