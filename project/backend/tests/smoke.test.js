import request from 'supertest';
import app from '../src/app.js';

test('la app responde y la BD de test está conectada', async () => {
  const res = await request(app).get('/api/categories/active');
  expect(res.status).toBe(200);
  expect(res.body.ok).toBe(true);
});