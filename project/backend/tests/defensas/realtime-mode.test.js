// Defensa 2: histéresis del push de notificaciones en tiempo real.
// Umbrales chicos por env para simular la carga sin abrir 1000 sockets.
process.env.NOTIF_RT_PAUSE_THRESHOLD = '5';
process.env.NOTIF_RT_RESUME_THRESHOLD = '3';

import {
  noteConnection, noteDisconnection, isRealtimeEnabled,
  getConnectedCount, setModeNotifier, _resetRealtimeMode,
} from '../../src/utils/realtimeMode.js';

beforeEach(() => _resetRealtimeMode());

// --runInBand: limpiar el env para los archivos que corren después.
afterAll(() => {
  delete process.env.NOTIF_RT_PAUSE_THRESHOLD;
  delete process.env.NOTIF_RT_RESUME_THRESHOLD;
});

const conectarN = (n) => { for (let i = 0; i < n; i++) noteConnection(); };
const desconectarN = (n) => { for (let i = 0; i < n; i++) noteDisconnection(); };

describe('histéresis de notificaciones RT (pausa >5, reanuda <3)', () => {
  test('arranca en tiempo real', () => {
    expect(isRealtimeEnabled()).toBe(true);
  });

  test('al superar el umbral ALTO se pausa el push', () => {
    conectarN(5);
    expect(isRealtimeEnabled()).toBe(true);  // 5 no supera 5 (es >)
    noteConnection();                        // 6 > 5
    expect(isRealtimeEnabled()).toBe(false);
    expect(getConnectedCount()).toBe(6);
  });

  test('NO se reactiva al bajar del umbral alto: recién por debajo del BAJO', () => {
    conectarN(6);
    expect(isRealtimeEnabled()).toBe(false);
    desconectarN(2); // 4 conectados: entre umbral bajo (3) y alto (5)
    expect(isRealtimeEnabled()).toBe(false); // histéresis: sigue pausado
    desconectarN(1); // 3 conectados: no es < 3 todavía
    expect(isRealtimeEnabled()).toBe(false);
    desconectarN(1); // 2 < 3 → se reactiva
    expect(isRealtimeEnabled()).toBe(true);
  });

  test('el notifier se dispara solo en las transiciones, con el modo nuevo', () => {
    const transiciones = [];
    setModeNotifier((rt) => transiciones.push(rt));

    conectarN(6);   // una transición a pausado
    conectarN(3);   // sigue pausado: sin transiciones nuevas
    desconectarN(7); // 2 conectados → una transición a tiempo real
    expect(transiciones).toEqual([false, true]);
  });

  test('oscilar entre los dos umbrales no prende y apaga el modo', () => {
    const transiciones = [];
    setModeNotifier((rt) => transiciones.push(rt));

    conectarN(6);      // pausa (6)
    desconectarN(2);   // 4: zona intermedia
    conectarN(2);      // 6 de nuevo
    desconectarN(2);   // 4
    expect(transiciones).toEqual([false]); // una sola transición en total
  });

  test('el contador nunca queda negativo', () => {
    desconectarN(3);
    expect(getConnectedCount()).toBe(0);
    expect(isRealtimeEnabled()).toBe(true);
  });
});
