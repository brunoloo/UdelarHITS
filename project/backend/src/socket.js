import { Server } from 'socket.io';
import { parseCookie } from 'cookie';
import jwt from 'jsonwebtoken';
import pool from './config/db.js';

export function initSocket(httpServer, app) {
  const allowedOrigins = (process.env.URL || '').split(',').map(s => s.trim()).filter(Boolean);

  const io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins.length > 0 ? allowedOrigins : true,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const cookies = parseCookie(socket.handshake.headers.cookie || '');
      const token = cookies.jwt;
      if (!token) return next(new Error('No autenticado'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { rows } = await pool.query(
        "SELECT id, rol, nickname FROM usuario WHERE id = $1 AND estado = 'activo'",
        [decoded.id]
      );
      if (!rows[0]) return next(new Error('Usuario no válido'));

      socket.userId = rows[0].id;
      socket.userNickname = rows[0].nickname;
      next();
    } catch (err) {
      console.error('Socket auth error:', err.message);
      next(new Error('Token inválido'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: user:${socket.userId} (${socket.userNickname})`);
    socket.join(`user:${socket.userId}`);
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: user:${socket.userId}`);
    });
  });

  app.set('io', io);
  return io;
}
