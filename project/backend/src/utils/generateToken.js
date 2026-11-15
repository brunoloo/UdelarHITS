import crypto from 'crypto';
import jwt from 'jsonwebtoken';

// Huella de la contraseña vigente. Viaja en el token para que un cambio o un
// reset de contraseña invalide las sesiones abiertas sin guardar estado.
export const passwordVersion = (passwordHash) =>
  crypto.createHash('sha256').update(String(passwordHash ?? '')).digest('hex').slice(0, 16);

export const generateToken = (id, passwordHash = null) =>
  jwt.sign({ id, pv: passwordVersion(passwordHash) }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });

// Los tokens emitidos antes de incorporar `pv` siguen valiendo hasta su vencimiento.
export const isTokenCurrent = (decoded, passwordHash) =>
  decoded.pv === undefined || decoded.pv === passwordVersion(passwordHash);
