import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import passport from './config/passport.js';

// Import routes
import API from './routes/API.js';

// Express
const app = express();

// Confiar en el proxy (Ngrok, Cloudflare, etc.) para que Rate Limiter obtenga la IP real
app.set('trust proxy', 1);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ubicación del build del frontend (Vite dist). En Railway el working directory
// y el layout del contenedor pueden diferir del entorno local, así que en vez de
// asumir una sola ruta relativa, se prueban varias ubicaciones candidatas y se
// elige la primera que realmente contenga index.html. La ruta elegida se loguea
// al arrancar para poder diagnosticar el deploy desde los logs de Railway.
const FRONTEND_DIST_CANDIDATES = [
  path.join(__dirname, '..', '..', 'frontend', 'dist'), // repo local: backend/src -> project/frontend/dist
  path.join(process.cwd(), 'frontend', 'dist'),          // cwd = project/
  path.join(process.cwd(), '..', 'frontend', 'dist'),    // cwd = project/backend/
];
const FRONTEND_DIST =
  FRONTEND_DIST_CANDIDATES.find((p) => fs.existsSync(path.join(p, 'index.html'))) ||
  FRONTEND_DIST_CANDIDATES[0];
const FRONTEND_INDEX = path.join(FRONTEND_DIST, 'index.html');
console.log(
  `[static] FRONTEND_DIST resuelto: ${FRONTEND_DIST} | index.html presente: ${fs.existsSync(FRONTEND_INDEX)}`
);

// Security headers (CSP, X-Frame-Options, X-Content-Type-Options, etc.)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'img-src': ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
      'script-src-attr': ["'none'"]
    }
  }
}));

app.use(compression());

// Allowlist de orígenes para CORS (separados por coma en .env)
const allowedOrigins = (process.env.URL || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Origen no permitido'));
  },
  credentials: true
}));

// Archivos estáticos: se sirven ANTES de cualquier middleware que dependa de la
// DB (passport, auth, etc.) para que un error de conexión a Postgres no impida
// servir el frontend. El orden importa: primero frontend/dist (que tiene su
// propia carpeta assets/), luego central/, luego el fallback de assets internos
// del backend (default-user.jpg).
app.use(express.static(FRONTEND_DIST));
app.use('/central', express.static(path.join(__dirname, '..', '..', 'central')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Cookie
app.use(cookieParser());

// Passport (solo Google OAuth) — sin sesiones, el proyecto usa JWT
app.use(passport.initialize());

// Body parsers con límite explícito
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// En test, los limiters son passthrough (evita 429 espurios en la suite)
const limiterIf = (limiter) => (req, res, next) =>
  process.env.NODE_ENV === 'test' ? next() : limiter(req, res, next);

// Rate limit general para toda la API
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Demasiadas solicitudes. Intentá de nuevo en un momento.' }
});
app.use('/api', limiterIf(apiLimiter));

// Rate limit estricto en endpoints de auth para frenar brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Demasiados intentos. Intentá de nuevo en unos minutos.' }
});
app.use('/api/auth/login', limiterIf(authLimiter));
app.use('/api/auth/register', limiterIf(authLimiter));
// Mismos límites estrictos para el resto de endpoints sensibles de auth:
// recuperación de contraseña y verificación por código (anti brute-force y
// anti-abuso de envío de mails).
app.use('/api/auth/forgot-password', limiterIf(authLimiter));
app.use('/api/auth/reset-password', limiterIf(authLimiter));
app.use('/api/auth/verify-reset-token', limiterIf(authLimiter));
app.use('/api/auth/verify-email', limiterIf(authLimiter));
app.use('/api/auth/resend-code', limiterIf(authLimiter));

// Anti-spam de creación de contenido: acota temas/comentarios por IP.
const contentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Estás creando contenido demasiado rápido. Esperá un momento.' }
});
app.use('/api/topics/create', limiterIf(contentLimiter));
app.use('/api/replies/create', limiterIf(contentLimiter));

// Anti-spam de reacciones (toggle like). Solo el POST; el GET de conteos es
// lectura pública y no se limita (una vista puede pedir muchos conteos).
const reactionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Demasiadas reacciones en poco tiempo. Esperá un momento.' }
});
app.use('/api/reactions', (req, res, next) =>
  req.method === 'POST' ? limiterIf(reactionLimiter)(req, res, next) : next());

// Rate limit para limitar búsquedas
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Demasiadas búsquedas. Intentá de nuevo en un momento.' }
});
app.use('/api/users/search', limiterIf(searchLimiter));

const reporteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Demasiados reportes en poco tiempo. Intentá de nuevo en un momento.' }
});
app.use('/api/reports', limiterIf(reporteLimiter));

// routes
app.use("/api", API);

// SPA fallback: cualquier ruta que no sea /api ni /central devuelve el index.html
// de React. Los pedidos a /assets/* son archivos reales del build: si no los
// sirvió express.static es que no existen, así que se devuelve un 404 explícito
// en vez de caer en el index.html (que produciría un MIME incorrecto) o en el
// error handler genérico (que respondería application/json y confundiría al
// navegador con "Refused to apply style / 500").
app.get('/{*path}', (req, res, next) => {
  if (req.path.startsWith('/assets/')) {
    return res.status(404).json({ ok: false, message: 'Recurso no encontrado' });
  }
  return res.sendFile(FRONTEND_INDEX, (err) => {
    if (err) next(err);
  });
});

// Error handler para multer y errores de upload
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        ok: false,
        message: 'La imagen es demasiado pesada. Máximo permitido: avatar 2MB, banner 3MB.'
      });
    }
    return res.status(400).json({ ok: false, message: 'Error al subir el archivo.' });
  }
  if (err.message === 'Solo se permiten imágenes') {
    return res.status(400).json({ ok: false, message: err.message });
  }
  next(err);
});

// Handler de error final: nunca exponer stack traces ni detalles internos al
// cliente. En producción se responde un mensaje genérico; los detalles solo se
// loguean fuera de producción para no volcar información sensible en los logs.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err);
  }
  return res.status(err.status || 500).json({ ok: false, message: 'Error interno del servidor' });
});

export default app;