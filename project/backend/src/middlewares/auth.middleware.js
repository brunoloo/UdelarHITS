import jwt from 'jsonwebtoken';
import pool from '../config/db.js';

export const protect = async (req, res, next) => {
  try {
    const token = req.cookies?.jwt;
    if (!token) {
      return res.status(401).json({ ok: false, message: 'No autenticado' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await pool.query(
      'SELECT id, rol, nickname, estado FROM usuario WHERE id = $1',
      [decoded.id]
    );

    if (!rows[0]) {
      return res.status(401).json({ ok: false, message: 'Usuario no válido' });
    }

    if (rows[0].estado !== 'activo') {
      res.clearCookie('jwt', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });
      return res.status(403).json({ ok: false, message: 'Esta cuenta no está activa' });
    }

    req.user = { id: rows[0].id, rol: rows[0].rol, nickname: rows[0].nickname };
    next();
  } catch (error) {
    return res.status(401).json({ ok: false, message: 'Token inválido o expirado' });
  }
};

export const isAdmin = (req, res, next) => {
  if (req.user?.rol !== 'admin') {
    return res.status(403).json({ ok: false, message: 'Acceso denegado' });
  }
  next();
};

export const optionalAuth = (req, res, next) => {
  const token = req.cookies?.jwt;
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { id: decoded.id, rol: decoded.rol, nickname: decoded.nickname };
    } catch {
      // Token inválido o expirado — continuar como invitado
    }
  }
  next();
};