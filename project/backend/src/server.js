import 'dotenv/config';
import http from 'http';
import app from './app.js';
import pool from './config/db.js';
import { initSocket } from './socket.js';
import { startCleanupJobs } from './jobs/cleanup.job.js';
import { isVisionConfigured } from './utils/checkImageSafety.js';

const PORT = Number(process.env.PORT || 5001);

// Moderación de imágenes: si no hay API key de Vision, el check queda
// desactivado (todo se publica sin analizar). Avisamos para que no pase
// desapercibido en producción — en desarrollo es esperable.
if (!isVisionConfigured()) {
  console.warn('[vision] GOOGLE_VISION_API_KEY no configurada: la moderación automática de imágenes está DESACTIVADA (todas las imágenes se publican sin análisis).');
}

const server = http.createServer(app);
initSocket(server, app);

// Jobs de limpieza (retención de chat + housekeeping de auth). Se arranca acá
// y no en app.js para que los tests (que importan app) no dejen timers vivos.
startCleanupJobs();

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Manejo de señales para cierre

let isShuttingDown = false;

const shutdown = (signal, error = null) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  if (error) console.error(`${signal}:`, error);
  else console.log(`${signal} received. Shutting down...`);

  const forceExit = setTimeout(async () => {
    console.warn('Forcing shutdown...');
    try { await pool.end(); } catch {}
    process.exit(error ? 1 : 0);
  }, 8000);

  server.close(async () => {
    clearTimeout(forceExit);
    try {
      await pool.end();
      process.exit(error ? 1 : 0);
    } catch (e) {
      console.error('Error closing DB pool:', e);
      process.exit(1);
    }
  });
};
