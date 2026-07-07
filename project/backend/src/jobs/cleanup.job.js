// Jobs periódicos de limpieza (Defensa 3 + housekeeping de auth).
//
// Se ejecutan con un setInterval simple (sin dependencia nueva tipo node-cron:
// el proyecto es single-instance y no necesita expresiones cron — una pasada
// diaria alcanza). El timer se arranca desde server.js (NO desde app.js, así
// los tests que importan la app no dejan timers colgados). unref() evita que
// el intervalo impida el shutdown del proceso.

import pool from '../config/db.js';

const retentionDays = () => Number(process.env.CHAT_RETENTION_DAYS || 30);

// Retención de chat: borra mensajes con más antigüedad que la ventana. La fila
// de `conversacion` se conserva (con su ultimo_mensaje_at): si una conversación
// queda sin mensajes, el listado y la apertura siguen funcionando — se muestra
// vacía, sin crash (verificado por test).
export const purgeOldChatMessages = async (days = retentionDays()) => {
  const { rowCount } = await pool.query(
    `DELETE FROM mensaje WHERE fecha_creacion < NOW() - make_interval(days => $1)`,
    [days]
  );
  return rowCount;
};

// Housekeeping de auth: filas usadas o vencidas (con 1 día de gracia) de las
// tablas de verificación de registro y reset de contraseña. Sin esto crecen
// indefinidamente: cada registro y cada "olvidé mi contraseña" deja una fila.
export const purgeExpiredAuthRows = async () => {
  const verif = await pool.query(
    `DELETE FROM verificacion_registro WHERE usado = TRUE OR expira_en < NOW() - interval '1 day'`
  );
  const tokens = await pool.query(
    `DELETE FROM token_reset_password WHERE usado = TRUE OR expira_en < NOW() - interval '1 day'`
  );
  return { verificaciones: verif.rowCount, tokens: tokens.rowCount };
};

export const runCleanup = async () => {
  try {
    const mensajes = await purgeOldChatMessages();
    const auth = await purgeExpiredAuthRows();
    if (mensajes || auth.verificaciones || auth.tokens) {
      console.log(
        `[cleanup] mensajes de chat purgados: ${mensajes}, verificaciones: ${auth.verificaciones}, tokens reset: ${auth.tokens}`
      );
    }
  } catch (err) {
    // Nunca tumbar el proceso por un fallo de limpieza: se reintenta en la
    // próxima pasada.
    console.error('[cleanup] error en la pasada de limpieza:', err.message);
  }
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const startCleanupJobs = () => {
  runCleanup(); // una pasada al arrancar
  const timer = setInterval(runCleanup, DAY_MS);
  timer.unref();
  return timer;
};
