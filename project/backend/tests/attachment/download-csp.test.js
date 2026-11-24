import request from 'supertest';
import app from '../../src/app.js';

// El frontend baja los documentos con fetch para guardarlos con su nombre original.
test('la CSP permite conectarse a Cloudinary', async () => {
  const res = await request(app).get('/health');
  const csp = res.headers['content-security-policy'] || '';
  const connectSrc = csp.split(';').map(d => d.trim()).find(d => d.startsWith('connect-src')) || '';
  expect(connectSrc.split(/\s+/)).toContain('https://res.cloudinary.com');
});
