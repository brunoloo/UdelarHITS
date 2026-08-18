import { escapeLike } from '../../src/utils/escapeLike.js';

// Unit del helper de escaping. No toca la BD (pero corre bajo el mismo setup, que
// hace TRUNCATE — inofensivo).
describe('escapeLike', () => {
  test('escapa % _ y \\ con backslash', () => {
    expect(escapeLike('100%')).toBe('100\\%');
    expect(escapeLike('a_b')).toBe('a\\_b');
    expect(escapeLike('c\\d')).toBe('c\\\\d');
  });

  test('deja intacto el texto sin comodines', () => {
    expect(escapeLike('resumen parcial')).toBe('resumen parcial');
    expect(escapeLike('Química')).toBe('Química');
  });

  test('escapa múltiples ocurrencias', () => {
    expect(escapeLike('%_%')).toBe('\\%\\_\\%');
  });

  test('null/undefined → cadena vacía', () => {
    expect(escapeLike(null)).toBe('');
    expect(escapeLike(undefined)).toBe('');
  });

  test('coacciona no-strings a string', () => {
    expect(escapeLike(100)).toBe('100');
  });
});
