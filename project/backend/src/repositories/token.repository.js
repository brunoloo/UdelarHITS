import pool from '../config/db.js';
import crypto from 'crypto';

// El token crudo solo viaja al usuario (en el email). En la BD guardamos su
// hash SHA-256 (64 chars hex, entra en la columna VARCHAR(64)) para que un
// acceso de lectura a la tabla no permita tomar cuentas con resets activos.
const hashToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');

export const createResetToken = async (usuarioId, token, expiraEn) => {
  // Invalidar tokens anteriores del mismo usuario
  await pool.query(
    `UPDATE token_reset_password SET usado = TRUE WHERE usuario_id = $1 AND usado = FALSE`,
    [usuarioId]
  );

  const q = `
    INSERT INTO token_reset_password (usuario_id, token, expira_en)
    VALUES ($1, $2, $3)
    RETURNING id, token, expira_en
  `;
  const { rows } = await pool.query(q, [usuarioId, hashToken(token), expiraEn]);
  return rows[0];
};

export const findValidToken = async (token) => {
  const q = `
    SELECT t.id, t.usuario_id, t.token, t.expira_en, t.usado
    FROM token_reset_password t
    WHERE t.token = $1
      AND t.usado = FALSE
      AND t.expira_en > NOW()
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [hashToken(token)]);
  return rows[0] || null;
};

export const markTokenAsUsed = async (tokenId) => {
  const q = `
    UPDATE token_reset_password SET usado = TRUE WHERE id = $1
  `;
  await pool.query(q, [tokenId]);
};