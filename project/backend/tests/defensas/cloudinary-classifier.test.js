// Clasificador de errores de cuota de Cloudinary (módulo real, sin mocks).
import { isCloudinaryQuotaError } from '../../src/utils/uploadToCloudinary.js';

describe('isCloudinaryQuotaError', () => {
  test('reconoce el http_code 420 de rate limit', () => {
    expect(isCloudinaryQuotaError({ http_code: 420, message: 'Rate Limit Exceeded' })).toBe(true);
  });

  test('reconoce mensajes de cuota/límite del plan', () => {
    expect(isCloudinaryQuotaError({ message: 'Account usage limit reached' })).toBe(true);
    expect(isCloudinaryQuotaError({ message: 'Your plan quota has been exceeded' })).toBe(true);
    expect(isCloudinaryQuotaError({ message: 'Not enough credits' })).toBe(true);
  });

  test('NO clasifica como cuota los errores comunes de archivo', () => {
    expect(isCloudinaryQuotaError({ message: 'Invalid image file' })).toBe(false);
    expect(isCloudinaryQuotaError({ http_code: 400, message: 'Unsupported format' })).toBe(false);
    expect(isCloudinaryQuotaError(undefined)).toBe(false);
    expect(isCloudinaryQuotaError({})).toBe(false);
  });
});
