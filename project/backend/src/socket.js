import { Server } from 'socket.io';
import { parseCookie } from 'cookie';
import jwt from 'jsonwebtoken';
import pool from './config/db.js';
import { releaseUserConversations } from './utils/chatLoad.js';
import { noteConnection, noteDisconnection, setModeNotifier, isRealtimeEnabled } from './utils/realtimeMode.js';

let ioInstance = null;

export function getIO() {
  return ioInstance;
}

export function initSocket(httpServer, app) {
  const allowedOrigins = (process.env.URL || '').split(',').map(s => s.trim()).filter(Boolean);

  // Misma allowlist que el CORS de Express: se permite same-origin (sin header
  // Origin) y los orígenes configurados en URL. Nunca se abre a cualquier
  // origen con credentials, ni siquiera si la allowlist está vacía.
  const io = new Server(httpServer, {
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

  // Aviso de cambio de modo de notificaciones (Defensa 2): cuando la carga
  // cruza los umbrales, todos los clientes conectados se enteran para pasar a
  // refrescar manualmente (o volver al tiempo real).
  setModeNotifier((realtime) => {
    io.emit('notificaciones:modo', { realtime });
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: user:${socket.userId} (${socket.userNickname})`);
    noteConnection();
    socket.join(`user:${socket.userId}`);
    // Si el cliente se conecta durante un modo degradado, que lo sepa desde el
    // arranque (el broadcast de transición ya pasó y no lo vio).
    if (!isRealtimeEnabled()) {
      socket.emit('notificaciones:modo', { realtime: false });
    }
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: user:${socket.userId}`);
      noteDisconnection();
      // Libera los lugares de chat activo de este usuario (Defensa 1).
      releaseUserConversations(socket.userId);
    });
  });

  ioInstance = io;
  app.set('io', io);
  return io;
}
