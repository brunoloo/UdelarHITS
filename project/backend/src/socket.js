import { Server } from 'socket.io';
import { parseCookie } from 'cookie';
import jwt from 'jsonwebtoken';
import pool from './config/db.js';
import { isTokenCurrent } from './utils/generateToken.js';
import { releaseUserConversations } from './utils/chatLoad.js';
import { permitidoPorBorde } from './middlewares/edge.middleware.js';
import { noteConnection, noteDisconnection, setModeNotifier, isRealtimeEnabled } from './utils/realtimeMode.js';

let ioInstance = null;

export function getIO() {
  return ioInstance;
}

export function initSocket(httpServer, app) {
  const allowedOrigins = (process.env.URL || '').split(',').map(s => s.trim()).filter(Boolean);

  // Misma allowlist que el CORS de Express.
  const io = new Server(httpServer, {
    allowRequest: (req, cb) => cb(null, permitidoPorBorde(req.headers)),
    cors: {
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error('Origen no permitido'));
      },
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const cookies = parseCookie(socket.handshake.headers.cookie || '');
      const token = cookies.jwt;
      if (!token) return next(new Error('No autenticado'));

      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      const { rows } = await pool.query(
        "SELECT id, rol, nickname, password_hash FROM usuario WHERE id = $1 AND estado = 'activo'",
        [decoded.id]
      );
      if (!rows[0]) return next(new Error('Usuario no válido'));
      if (!isTokenCurrent(decoded, rows[0].password_hash)) return next(new Error('Token inválido'));

      socket.userId = rows[0].id;
      socket.userNickname = rows[0].nickname;
      next();
    } catch (err) {
      console.error('Socket auth error:', err.message);
      next(new Error('Token inválido'));
    }
  });

  // Avisa a los clientes cuando el tiempo real se pausa o se reanuda por carga.
  setModeNotifier((realtime) => {
    io.emit('notificaciones:modo', { realtime });
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: user:${socket.userId} (${socket.userNickname})`);
    noteConnection();
    socket.join(`user:${socket.userId}`);
    // El aviso de transición pudo emitirse antes de que este cliente se conectara.
    if (!isRealtimeEnabled()) {
      socket.emit('notificaciones:modo', { realtime: false });
    }
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: user:${socket.userId}`);
      noteDisconnection();
      releaseUserConversations(socket.userId);
    });
  });

  ioInstance = io;
  app.set('io', io);
  return io;
}
