import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createAdmin } from '../helpers.js';

describe('User Reports', () => {

  // ── POST /:nickname/report ─────────────────────────────

  describe('POST /api/user-reports/:nickname/report', () => {

    it('rechaza sin sesión (401)', async () => {
      const res = await request(app)
        .post('/api/user-reports/alguien/report')
        .send({ motivo: 'Comportamiento inapropiado repetido' });

      expect(res.status).toBe(401);
    });

    it('rechaza si falta motivo o es muy corto (400)', async () => {
      const reporter = await registerAndLogin();
      const reported = await registerAndLogin();

      const res = await request(app)
        .post(`/api/user-reports/${reported.user.nickname}/report`)
        .set('Cookie', reporter.cookie)
        .send({ motivo: 'corto' });

      expect(res.status).toBe(400);
    });

    it('rechaza reportarse a sí mismo (400)', async () => {
      const user = await registerAndLogin();

      const res = await request(app)
        .post(`/api/user-reports/${user.user.nickname}/report`)
        .set('Cookie', user.cookie)
        .send({ motivo: 'Intentando reportarme a mí mismo' });

      expect(res.status).toBe(400);
    });

    it('crea un reporte correctamente (201)', async () => {
      const reporter = await registerAndLogin();
      const reported = await registerAndLogin();

      const res = await request(app)
        .post(`/api/user-reports/${reported.user.nickname}/report`)
        .set('Cookie', reporter.cookie)
        .send({ motivo: 'Comportamiento inapropiado repetido en varios temas' });

      expect(res.status).toBe(201);
      expect(res.body.ok).toBe(true);
      expect(res.body.data.estado).toBe('pendiente');
    });

    it('rechaza reporte duplicado (400)', async () => {
      const reporter = await registerAndLogin();
      const reported = await registerAndLogin();

      await request(app)
        .post(`/api/user-reports/${reported.user.nickname}/report`)
        .set('Cookie', reporter.cookie)
        .send({ motivo: 'Primera vez reportando a este usuario' });

      const res = await request(app)
        .post(`/api/user-reports/${reported.user.nickname}/report`)
        .set('Cookie', reporter.cookie)
        .send({ motivo: 'Intentando reportar de nuevo al mismo' });

      expect(res.status).toBe(400);
    });

    it('rechaza usuario inexistente (404)', async () => {
      const reporter = await registerAndLogin();

      const res = await request(app)
        .post('/api/user-reports/noexiste/report')
        .set('Cookie', reporter.cookie)
        .send({ motivo: 'Reportando a alguien que no existe' });

      expect(res.status).toBe(404);
    });
  });

  // ── GET /pending ───────────────────────────────────────

  describe('GET /api/user-reports/pending', () => {

    it('rechaza sin ser admin (401 o 403)', async () => {
      const user = await registerAndLogin();

      const res = await request(app)
        .get('/api/user-reports/pending')
        .set('Cookie', user.cookie);

      expect([401, 403]).toContain(res.status);
    });

    it('devuelve reportes pendientes para admin', async () => {
      const admin = await createAdmin();
      const reporter = await registerAndLogin();
      const reported = await registerAndLogin();

      await request(app)
        .post(`/api/user-reports/${reported.user.nickname}/report`)
        .set('Cookie', reporter.cookie)
        .send({ motivo: 'Motivo válido para el reporte del usuario' });

      const res = await request(app)
        .get('/api/user-reports/pending')
        .set('Cookie', admin.cookie);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].reportado_nickname).toBe(reported.user.nickname);
    });
  });

  // ── PATCH /:id/resolve ─────────────────────────────────

  describe('PATCH /api/user-reports/:id/resolve', () => {

    it('levantar reporte no afecta al usuario', async () => {
      const admin = await createAdmin();
      const reporter = await registerAndLogin();
      const reported = await registerAndLogin();

      const report = await request(app)
        .post(`/api/user-reports/${reported.user.nickname}/report`)
        .set('Cookie', reporter.cookie)
        .send({ motivo: 'Motivo válido para el reporte del usuario' });

      const res = await request(app)
        .patch(`/api/user-reports/${report.body.data.id}/resolve`)
        .set('Cookie', admin.cookie)
        .send({ decision: 'levantar' });

      expect(res.status).toBe(200);
      expect(res.body.data.decision).toBe('levantar');

      // Usuario sigue activo
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: reported.raw.email, password: reported.raw.password });

      expect(login.status).toBe(200);
    });

    it('ban deja la cuenta del usuario en estado ban y bloquea el login', async () => {
      const admin = await createAdmin();
      const reporter = await registerAndLogin();
      const reported = await registerAndLogin();

      const report = await request(app)
        .post(`/api/user-reports/${reported.user.nickname}/report`)
        .set('Cookie', reporter.cookie)
        .send({ motivo: 'Motivo válido para el reporte del usuario' });

      const res = await request(app)
        .patch(`/api/user-reports/${report.body.data.id}/resolve`)
        .set('Cookie', admin.cookie)
        .send({ decision: 'ban' });

      expect(res.status).toBe(200);

      // Usuario baneado no puede loguearse
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: reported.raw.email, password: reported.raw.password });

      expect(login.status).toBe(403);

      // Estado es ban
      const { rows } = await pool.query(
        'SELECT estado FROM usuario WHERE id = $1', [reported.user.id]
      );
      expect(rows[0].estado).toBe('ban');
    });

    it('rechaza decisión inválida (400)', async () => {
      const admin = await createAdmin();
      const reporter = await registerAndLogin();
      const reported = await registerAndLogin();

      const report = await request(app)
        .post(`/api/user-reports/${reported.user.nickname}/report`)
        .set('Cookie', reporter.cookie)
        .send({ motivo: 'Motivo válido para el reporte del usuario' });

      const res = await request(app)
        .patch(`/api/user-reports/${report.body.data.id}/resolve`)
        .set('Cookie', admin.cookie)
        .send({ decision: 'inventada' });

      expect(res.status).toBe(400);
    });
  });
});