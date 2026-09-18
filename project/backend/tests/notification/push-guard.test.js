// Cortocircuito de sendWebPush en NODE_ENV=test. Va en un archivo APARTE de
// push.test.js a propósito: ahí el módulo está mockeado con
// jest.unstable_mockModule para poder assertear el enganche, y en ESM no hay
// forma de recuperar el módulo real dentro del mismo archivo (el registro de
// módulos devuelve el mock aunque se le agregue un query string al specifier).
// Acá se importa el módulo de verdad y se verifica el guard.

import { schedulePushForNotification, isPushConfigured } from '../../src/utils/sendWebPush.js';

describe('sendWebPush: cortocircuito en test', () => {
  test('no agenda nada, no lanza y no deja timers vivos', () => {
    expect(process.env.NODE_ENV).toBe('test');

    // Un timer sin unref() (o uno agendado a pesar del guard) aparecería acá y
    // Jest lo reportaría después como handle abierto.
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
