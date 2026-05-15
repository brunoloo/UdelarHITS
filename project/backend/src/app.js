import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

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

// Body parsers con límite explícito
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Rate limit estricto en endpoints de auth para frenar brute-force
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Demasiados intentos. Intentá de nuevo en unos minutos.' }
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Rate limit para limitar búsquedas
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Demasiadas búsquedas. Intentá de nuevo en un minuto.' }
});
app.use('/api/users/search', searchLimiter);

// Rate limit general para toda la API
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', apiLimiter);

//index (usamos el index que aparece en frontend) — path estable, no depende del cwd
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

// routes
app.use("/api", API);

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