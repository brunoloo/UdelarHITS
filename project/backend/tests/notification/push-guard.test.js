// En un archivo aparte: en push.test.js el módulo está mockeado y en ESM no se puede recuperar el real.

import { schedulePushForNotification, isPushConfigured } from '../../src/utils/sendWebPush.js';

describe('sendWebPush: cortocircuito en test', () => {
  test('no agenda nada, no lanza y no deja timers vivos', () => {
    expect(process.env.NODE_ENV).toBe('test');

    // Un timer sin unref() aparecería acá como handle abierto.
    const antes = process._getActiveHandles().length;
    expect(() => schedulePushForNotification(123456)).not.toThrow();
    expect(process._getActiveHandles().length).toBe(antes);
  });

  test('sin claves VAPID en .env.test el push queda desconfigurado', () => {
    expect(isPushConfigured()).toBe(false);
  });

  test('un id nulo tampoco rompe', () => {
    expect(() => schedulePushForNotification(null)).not.toThrow();
  });
});
