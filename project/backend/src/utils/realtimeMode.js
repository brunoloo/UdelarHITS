// Con histéresis: al superar el umbral alto se pausa el aviso en tiempo real (las
// notificaciones se siguen guardando) y recién se reanuda al bajar del umbral bajo,
// para que el modo no oscile.

let connected = 0;
let realtime = true;
let notifier = null; // (realtime: boolean) => void — lo registra socket.js

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

// Se dispara solo en las transiciones de modo.
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
