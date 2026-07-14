import { jest } from '@jest/globals';

// Moderación automática de imágenes (Cloud Vision SafeSearch). Mockeamos el
// módulo de Vision ANTES de importar la app (mismo patrón ESM que el mock de
// Cloudinary en tests/upload). checkImageSafety se controla por test;
// isVisionConfigured devuelve true para que avatar/banner tomen el camino de
// moderación (subir a pendiente → analizar).
jest.unstable_mockModule('../../src/utils/checkImageSafety.js', () => ({
  checkImageSafety: jest.fn(async () => ({ safe: true })),
  isVisionConfigured: jest.fn(() => true),
}));

const { checkImageSafety } = await import('../../src/utils/checkImageSafety.js');
const { purgeExpiredPendingImages } = await import('../../src/services/pendingImage.service.js');
const request = (await import('supertest')).default;
const app = (await import('../../src/app.js')).default;
const pool = (await import('../../src/config/db.js')).default;
const { registerAndLogin, createAdmin, createTopic } = await import('../helpers.js');

// PNG 1x1 real (magic numbers válidos).
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64'
);
const PDF = Buffer.from('%PDF-1.4\n%binarycontent\n', 'binary');

const LIKELY = { safe: false, scores: { adult: 'LIKELY', racy: 'UNLIKELY' } };

const adjuntoRow = async (id) => {
  const { rows } = await pool.query('SELECT estado, url, public_id FROM adjunto WHERE id = $1', [id]);
  return rows[0];
};
const countNotif = async (usuarioId, tipo) => {
  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS n FROM notificacion WHERE usuario_id = $1 AND tipo = $2', [usuarioId, tipo]
  );
  return rows[0].n;
};

beforeEach(() => {
  checkImageSafety.mockReset();
  checkImageSafety.mockResolvedValue({ safe: true });
});

describe('Moderación de adjuntos de imagen', () => {
  test('(a) imagen marcada (LIKELY) → adjunto pendiente_revision, comentario publicado', async () => {
    checkImageSafety.mockResolvedValue(LIKELY);
    const u = await registerAndLogin();
    const topic = await createTopic(u.cookie);

    const res = await request(app).post('/api/replies/create')
      .set('Cookie', u.cookie)
      .field('cuerpo', 'con imagen dudosa')
      .field('tema_id', String(topic.id ?? topic.contenido_id))
      .attach('archivos', PNG, { filename: 'foto.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    // El comentario se publica normalmente.
    const { rows } = await pool.query('SELECT id FROM contenido WHERE id = $1', [res.body.data.contenido_id]);
    expect(rows.length).toBe(1);
    // El adjunto quedó en revisión.
    const adj = res.body.data.adjuntos[0];
    expect(adj.estado).toBe('pendiente_revision');
    expect((await adjuntoRow(adj.id)).estado).toBe('pendiente_revision');
  });

  test('(b) imagen segura (UNLIKELY) → adjunto publicado', async () => {
    checkImageSafety.mockResolvedValue({ safe: true });
    const u = await registerAndLogin();
    const topic = await createTopic(u.cookie);

    const res = await request(app).post('/api/replies/create')
      .set('Cookie', u.cookie)
      .field('cuerpo', 'imagen ok')
      .field('tema_id', String(topic.id ?? topic.contenido_id))
      .attach('archivos', PNG, { filename: 'ok.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.data.adjuntos[0].estado).toBe('publicado');
  });

  test('(c) documento (PDF) → no pasa por Vision, publicado directo', async () => {
    const u = await registerAndLogin();
    const topic = await createTopic(u.cookie);

    const res = await request(app).post('/api/replies/create')
      .set('Cookie', u.cookie)
      .field('cuerpo', 'un pdf')
      .field('tema_id', String(topic.id ?? topic.contenido_id))
      .attach('archivos', PDF, { filename: 'doc.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(res.body.data.adjuntos[0].estado).toBe('publicado');
    // Clave: Vision NUNCA se llamó para un documento.
    expect(checkImageSafety).not.toHaveBeenCalled();
  });

  test('(h) fallback: si Vision falla (throw), el adjunto se publica igual', async () => {
    checkImageSafety.mockRejectedValue(new Error('vision caído'));
    const u = await registerAndLogin();
    const topic = await createTopic(u.cookie);

    const res = await request(app).post('/api/replies/create')
      .set('Cookie', u.cookie)
      .field('cuerpo', 'imagen con vision caido')
      .field('tema_id', String(topic.id ?? topic.contenido_id))
      .attach('archivos', PNG, { filename: 'foto.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.data.adjuntos[0].estado).toBe('publicado');
  });
});

describe('Moderación de avatar', () => {
  test('(d) avatar marcado (LIKELY) → va a imagen_pendiente, url_imagen NO se actualiza', async () => {
    checkImageSafety.mockResolvedValue(LIKELY);
    const u = await registerAndLogin();

    const res = await request(app).patch('/api/users/me/avatar')
      .set('Cookie', u.cookie)
      .attach('avatar', PNG, 'foto.png');

    expect(res.status).toBe(200);
    expect(res.body.pending).toBe(true);

    // La columna del usuario sigue sin foto (sigue viendo su avatar anterior/default).
    const { rows: userRows } = await pool.query('SELECT url_imagen FROM usuario WHERE id = $1', [u.user.id]);
    expect(userRows[0].url_imagen).toBeNull();

    // La imagen quedó retenida en imagen_pendiente.
    const { rows: pend } = await pool.query(
      `SELECT tipo FROM imagen_pendiente WHERE usuario_id = $1`, [u.user.id]
    );
    expect(pend).toHaveLength(1);
    expect(pend[0].tipo).toBe('avatar');
  });
});

describe('Auto-descarte a las 48h', () => {
  test('(e) adjunto pendiente hace 49h → rechazado + notificación', async () => {
    checkImageSafety.mockResolvedValue(LIKELY);
    const u = await registerAndLogin();
    const topic = await createTopic(u.cookie);
    const res = await request(app).post('/api/replies/create')
      .set('Cookie', u.cookie)
      .field('cuerpo', 'vieja')
      .field('tema_id', String(topic.id ?? topic.contenido_id))
      .attach('archivos', PNG, { filename: 'foto.png', contentType: 'image/png' });
    const adjId = res.body.data.adjuntos[0].id;

    // Envejecer la fila 49 horas (sin esperar en tiempo real).
    await pool.query(
      `UPDATE adjunto SET fecha_creacion = NOW() - interval '49 hours' WHERE id = $1`, [adjId]
    );

    const out = await purgeExpiredPendingImages(48);
    expect(out.adjuntos).toBe(1);

    const adj = await adjuntoRow(adjId);
    expect(adj.estado).toBe('rechazado');
    expect(adj.url).toBe('');
    expect(await countNotif(u.user.id, 'moderacion_imagen')).toBe(1);
  });
});

describe('Cola de admin — aprobar / rechazar', () => {
  async function createPendingAdjunto() {
    checkImageSafety.mockResolvedValue(LIKELY);
    const u = await registerAndLogin();
    const topic = await createTopic(u.cookie);
    const res = await request(app).post('/api/replies/create')
      .set('Cookie', u.cookie)
      .field('cuerpo', 'pendiente')
      .field('tema_id', String(topic.id ?? topic.contenido_id))
      .attach('archivos', PNG, { filename: 'foto.png', contentType: 'image/png' });
    checkImageSafety.mockResolvedValue({ safe: true });
    return { author: u, adjId: res.body.data.adjuntos[0].id };
  }

  test('(f) aprobar adjunto → estado publicado', async () => {
    const { adjId } = await createPendingAdjunto();
    const admin = await createAdmin();

    const res = await request(app)
      .patch(`/api/admin/pending-images/${adjId}/approve`)
      .set('Cookie', admin.cookie)
      .send({ origen: 'adjunto' });

    expect(res.status).toBe(200);
    expect((await adjuntoRow(adjId)).estado).toBe('publicado');
  });

  test('(g) rechazar adjunto → estado rechazado, url limpia y notificación', async () => {
    const { author, adjId } = await createPendingAdjunto();
    const admin = await createAdmin();

    const res = await request(app)
      .patch(`/api/admin/pending-images/${adjId}/reject`)
      .set('Cookie', admin.cookie)
      .send({ origen: 'adjunto' });

    expect(res.status).toBe(200);
    const adj = await adjuntoRow(adjId);
    expect(adj.estado).toBe('rechazado');
    expect(adj.url).toBe('');
    expect(await countNotif(author.user.id, 'moderacion_imagen')).toBe(1);
  });

  test('la cola lista el adjunto pendiente con su contexto', async () => {
    const { adjId } = await createPendingAdjunto();
    const admin = await createAdmin();

    const res = await request(app)
      .get('/api/admin/pending-images')
      .set('Cookie', admin.cookie);

    expect(res.status).toBe(200);
    const item = res.body.data.find(i => i.origen === 'adjunto' && i.id === adjId);
    expect(item).toBeTruthy();
    expect(item.autor_nickname).toBeTruthy();
    expect(item.contexto).toMatch(/Adjunto en/);
  });

  test('un usuario no-admin no puede acceder a la cola', async () => {
    const u = await registerAndLogin();
    const res = await request(app).get('/api/admin/pending-images').set('Cookie', u.cookie);
    expect(res.status).toBe(403);
  });
});
