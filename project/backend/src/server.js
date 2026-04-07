import 'dotenv/config';
import app from './app.js';
import pool from './config/db.js';

const PORT = Number(process.env.PORT || 5001);

const server = app.listen(PORT,'0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Manejo de señales para cierre (no dar mucha bola por ahora)

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