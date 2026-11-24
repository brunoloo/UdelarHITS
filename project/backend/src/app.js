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
import pool from './config/db.js';
import maintenanceMiddleware from './middlewares/maintenance.middleware.js';

import API from './routes/API.js';
import SEORoutes from './routes/seo.routes.js';

const app = express();

// Detrás de un proxy: necesario para que el rate limiter vea la IP real del cliente.
app.set('trust proxy', 1);

// Va primero: en mantenimiento no se tocan Helmet, los estáticos ni la base.
app.use(maintenanceMiddleware);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// El directorio de trabajo difiere entre el entorno local y el contenedor de deploy.
const FRONTEND_DIST_CANDIDATES = [
  path.join(__dirname, '..', '..', 'frontend', 'dist'),
  path.join(process.cwd(), 'frontend', 'dist'),
  path.join(process.cwd(), '..', 'frontend', 'dist'),
];
const FRONTEND_DIST =
  FRONTEND_DIST_CANDIDATES.find((p) => fs.existsSync(path.join(p, 'index.html'))) ||
  FRONTEND_DIST_CANDIDATES[0];
const FRONTEND_INDEX = path.join(FRONTEND_DIST, 'index.html');
console.log(
  `[static] FRONTEND_DIST resuelto: ${FRONTEND_DIST} | index.html presente: ${fs.existsSync(FRONTEND_INDEX)}`
);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      // El hash autoriza el script inline de frontend/index.html; si se edita, hay que recalcularlo.
      'script-src': [
        "'self'",
        'https://www.googletagmanager.com',
        "'sha256-o0tVFZWJlj9dJcUwUM6kbSpq0uTUvi/G4pH5Tl2Pt5s='"
      ],
      'connect-src': [
        "'self'",
        // Descarga de adjuntos con su nombre original.
        'https://res.cloudinary.com',
        'https://www.google-analytics.com',
        'https://*.google-analytics.com',
        'https://*.analytics.google.com',
        'https://www.googletagmanager.com'
      ],
      'img-src': [
        "'self'",
        'data:',
        'blob:',
        'https://res.cloudinary.com',
        'https://www.google-analytics.com',
        'https://*.google-analytics.com',
        'https://www.googletagmanager.com'
      ],
      // Embeds de YouTube en comentarios.
      'frame-src': [
        "'self'",
        'https://www.youtube-nocookie.com'
      ],
      'worker-src': ["'self'"],
      'script-src-attr': ["'none'"]
    }
  }
}));

// Antes de los estáticos: un middleware solo afecta lo que se monta después.
app.use(compression());

// Antes de CORS: los módulos ES envían Origin y los assets públicos no deben validarlo.
// Los assets llevan hash en el nombre y se cachean sin límite; index.html, nunca.
app.use(express.static(FRONTEND_DIST, {
  setHeaders: (res, filePath) => {
    if (/[/\\]assets[/\\]/.test(filePath)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else if (filePath.endsWith('index.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    } else if (filePath.endsWith('sw.js')) {
      // Sin hash en el nombre: si se cachea, no puede actualizarse.
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));
app.use('/central', express.static(path.join(__dirname, '..', '..', 'central')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Debe responder también en modo mantenimiento.
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.status(200).json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

// Orígenes permitidos, separados por coma en URL.
const allowedOrigins = (process.env.URL || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    const err = new Error('Origen no permitido');
    err.status = 403;
    return cb(err);
  },
  credentials: true
}));

app.use(cookieParser());

// Sin sesiones de servidor: la autenticación es por JWT.
app.use(passport.initialize());

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// En test los limiters no aplican, para evitar 429 espurios.
const limiterIf = (limiter) => (req, res, next) =>
  process.env.NODE_ENV === 'test' ? next() : limiter(req, res, next);

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Demasiadas solicitudes. Intentá de nuevo en un momento.' }
});
app.use('/api', limiterIf(apiLimiter));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Demasiados intentos. Intentá de nuevo en unos minutos.' }
});
app.use('/api/auth/login', limiterIf(authLimiter));
app.use('/api/auth/register', limiterIf(authLimiter));
app.use('/api/auth/forgot-password', limiterIf(authLimiter));
app.use('/api/auth/reset-password', limiterIf(authLimiter));
app.use('/api/auth/verify-reset-token', limiterIf(authLimiter));
app.use('/api/auth/verify-email', limiterIf(authLimiter));
app.use('/api/auth/resend-code', limiterIf(authLimiter));
// Endpoints autenticados que verifican la contraseña actual.
app.use('/api/users/change-password', limiterIf(authLimiter));
app.use('/api/users/me/deactivate', limiterIf(authLimiter));

const contentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Estás creando contenido demasiado rápido. Esperá un momento.' }
});
app.use('/api/topics/create', limiterIf(contentLimiter));
app.use('/api/replies/create', limiterIf(contentLimiter));
app.use('/api/categories/create', limiterIf(contentLimiter));
app.use('/api/appeals/create', limiterIf(contentLimiter));
app.use('/api/notifications/push/subscribe', limiterIf(contentLimiter));

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Estás enviando mensajes demasiado rápido. Esperá un momento.' }
});
app.use('/api/chat', (req, res, next) =>
  req.method === 'POST' ? limiterIf(chatLimiter)(req, res, next) : next());

// Solo el POST: el GET de conteos es lectura pública.
const reactionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Demasiadas reacciones en poco tiempo. Esperá un momento.' }
});
app.use('/api/reactions', (req, res, next) =>
  req.method === 'POST' ? limiterIf(reactionLimiter)(req, res, next) : next());

const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Demasiadas búsquedas. Intentá de nuevo en un momento.' }
});
app.use('/api/users/search', limiterIf(searchLimiter));

// Más alto que el de usuarios: el buscador del header consulta mientras se tipea.
const siteSearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Demasiadas búsquedas. Intentá de nuevo en un momento.' }
});
app.use('/api/search', limiterIf(siteSearchLimiter));

const reporteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Demasiados reportes en poco tiempo. Intentá de nuevo en un momento.' }
});
app.use('/api/reports', limiterIf(reporteLimiter));
app.use('/api/user-reports', (req, res, next) =>
  req.method === 'POST' ? limiterIf(reporteLimiter)(req, res, next) : next());

app.use("/api", API);

// Una ruta de API inexistente responde JSON, no el index.html de la SPA.
app.use('/api', (req, res) => {
  res.status(404).json({ ok: false, message: 'Recurso no encontrado' });
});

// Después de /api y antes del catch-all: inyecta metadata por URL para buscadores y previews.
app.use(SEORoutes);

// Un asset o un archivo de /.well-known inexistente responde 404, no el index.html.
app.get('/{*path}', (req, res, next) => {
  if (req.path.startsWith('/assets/') || req.path.startsWith('/.well-known/')) {
    return res.status(404).json({ ok: false, message: 'Recurso no encontrado' });
  }
  // index.html referencia bundles con hash: no debe cachearse.
  res.setHeader('Cache-Control', 'no-cache');
  return res.sendFile(FRONTEND_INDEX, (err) => {
    if (err) next(err);
  });
});

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

// Nunca se exponen stack traces ni detalles internos al cliente.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err);
  }
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  let message = 'Error interno del servidor';
  if (status === 403) message = 'Solicitud no permitida';
  else if (status < 500) message = 'Solicitud inválida';
  return res.status(status).json({ ok: false, message });
});

export default app;