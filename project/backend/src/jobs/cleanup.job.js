// Pasada diaria con setInterval: el proyecto corre en una sola instancia.
// unref() evita que el timer bloquee el cierre del proceso.

import pool from '../config/db.js';
import { purgeExpiredPendingImages } from '../services/pendingImage.service.js';

const retentionDays = () => Number(process.env.CHAT_RETENTION_DAYS || 30);

// La conversación se conserva aunque quede sin mensajes.
export const purgeOldChatMessages = async (days = retentionDays()) => {
  const { rowCount } = await pool.query(
    `DELETE FROM mensaje WHERE fecha_creacion < NOW() - make_interval(days => $1)`,
    [days]
  );
  return rowCount;
};

// Filas usadas o vencidas, con un día de gracia.
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
    // Sin acción de un admin, una imagen pendiente se descarta igual que al rechazarla.
    const imagenes = await purgeExpiredPendingImages();
    if (mensajes || auth.verificaciones || auth.tokens || imagenes.adjuntos || imagenes.imagenes) {
      console.log(
        `[cleanup] mensajes de chat purgados: ${mensajes}, verificaciones: ${auth.verificaciones}, tokens reset: ${auth.tokens}, ` +
        `imágenes pendientes descartadas: ${imagenes.adjuntos} adjuntos + ${imagenes.imagenes} avatares/banners`
      );
    }
  } catch (err) {
    // Un fallo de limpieza no detiene el proceso: se reintenta en la próxima pasada.
    console.error('[cleanup] error en la pasada de limpieza:', err.message);
  }
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const startCleanupJobs = () => {
  runCleanup();
  const timer = setInterval(runCleanup, DAY_MS);
  timer.unref();
  return timer;
};
