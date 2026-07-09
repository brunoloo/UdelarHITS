// Modo de notificaciones en tiempo real con histéresis (Defensa 2).
//
// Cuenta los sockets conectados (cualquier usuario con la pestaña abierta
// mantiene uno para notificaciones). Al superar el umbral ALTO se deja de
// emitir notificaciones push en tiempo real — las notificaciones se siguen
// PERSISTIENDO normalmente en la BD, solo se apaga el emit — y se avisa a los
// clientes con un evento explícito para que pasen a buscar manualmente.
// Recién al bajar del umbral BAJO se reactiva el push (histéresis: dos
// umbrales distintos para que el modo no oscile si el conteo baila justo en
// el límite).
//
// Este contador es independiente del registro de chat activo (chatLoad.js):
// ni comparten estado ni interruptor.

let connected = 0;
let realtime = true;
let notifier = null; // (realtime: boolean) => void — lo registra socket.js

// Umbrales leídos de forma perezosa (configurables por env, testeables).
const pauseThreshold = () => Number(process.env.NOTIF_RT_PAUSE_THRESHOLD || 1000);
const resumeThreshold = () => Number(process.env.NOTIF_RT_RESUME_THRESHOLD || 800);

const update = () => {
  if (realtime && connected > pauseThreshold()) {
    realtime = false;
    notifier?.(false);
  } else if (!realtime && connected < resumeThreshold()) {
    realtime = true;
    notifier?.(true);
  }
};

// Callback que se dispara SOLO en las transiciones de modo (no en cada conexión).
export const setModeNotifier = (fn) => { notifier = fn; };

export const noteConnection = () => { connected++; update(); };

export const noteDisconnection = () => {
  connected = Math.max(0, connected - 1);
  update();
};

export const isRealtimeEnabled = () => realtime;
export const getConnectedCount = () => connected;

// Solo para tests.
export const _resetRealtimeMode = () => { connected = 0; realtime = true; notifier = null; };
