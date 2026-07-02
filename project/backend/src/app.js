import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
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

// Security headers (CSP, X-Frame-Options, X-Content-Type-Options, etc.)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'img-src': ["'self'", 'data:', 'blob:', 'https:'], // https://res.cloudinary.com poner eso en vez de https para mayor protección
      'script-src-attr': ["'none'"]
    }
  }
}));

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

// La Central — capa institucional (HTML estático, siempre light)
app.use('/central', express.static(path.join(__dirname, '..', '..', 'central')));

// React SPA build (Vite dist)
app.use(express.static(path.join(__dirname, '..', '..', 'frontend', 'dist')));

// routes
app.use("/api", API);

// SPA fallback: cualquier ruta que no sea /api ni /central devuelve el index.html de React
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'frontend', 'dist', 'index.html'));
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

export default app;