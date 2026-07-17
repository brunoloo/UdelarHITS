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
const notifMsgs = async (usuarioId) => {
  const { rows } = await pool.query(
    `SELECT mensaje FROM notificacion WHERE usuario_id = $1 AND tipo = 'moderacion_imagen' ORDER BY id`,
    [usuarioId]
  );
  return rows.map(r => r.mensaje);
};
const hasNotif = async (usuarioId, re) => (await notifMsgs(usuarioId)).some(m => re.test(m));

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
    // El autor recibe una notificación de "en revisión".
    expect(await hasNotif(u.user.id, /revisión/i)).toBe(true);
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
    // El usuario recibe la notificación de "en revisión".
    expect(await hasNotif(u.user.id, /revisión/i)).toBe(true);
  });

  test('aprobar avatar → mueve el asset a la carpeta canónica avatars, borra la fila pendiente y notifica', async () => {
    checkImageSafety.mockResolvedValue(LIKELY);
    const u = await registerAndLogin();
    await request(app).patch('/api/users/me/avatar').set('Cookie', u.cookie).attach('avatar', PNG, 'foto.png');
    checkImageSafety.mockResolvedValue({ safe: true });

    const { rows: pendRows } = await pool.query('SELECT id FROM imagen_pendiente WHERE usuario_id = $1', [u.user.id]);
    const pendId = pendRows[0].id;

    const admin = await createAdmin();
    const res = await request(app)
      .patch(`/api/admin/pending-images/${pendId}/approve`)
      .set('Cookie', admin.cookie)
      .send({ origen: 'avatar' });
    expect(res.status).toBe(200);

    // url_imagen quedó en la carpeta canónica (no en pending): así el borrado
    // posterior la encuentra y no queda huérfana en Cloudinary.
    const { rows: userRows } = await pool.query('SELECT url_imagen FROM usuario WHERE id = $1', [u.user.id]);
    expect(userRows[0].url_imagen).toMatch(/avatars\/avatar_/);
    expect(userRows[0].url_imagen).not.toMatch(/pending/);

    // La fila pendiente se borró y el autor recibió la notificación de aprobación.
    const { rows: gone } = await pool.query('SELECT id FROM imagen_pendiente WHERE id = $1', [pendId]);
    expect(gone).toHaveLength(0);
    expect(await hasNotif(u.user.id, /aprobada/i)).toBe(true);
  });

  test('superseding: subir otro avatar con uno pendiente reemplaza al anterior (no coexisten dos)', async () => {
    checkImageSafety.mockResolvedValue(LIKELY);
    const u = await registerAndLogin();
    await request(app).patch('/api/users/me/avatar').set('Cookie', u.cookie).attach('avatar', PNG, 'a.png');
    const first = await pool.query('SELECT id FROM imagen_pendiente WHERE usuario_id = $1 AND tipo = $2', [u.user.id, 'avatar']);
    expect(first.rows).toHaveLength(1);

    // Segundo avatar, también sospechoso, sin esperar la resolución del primero.
    await request(app).patch('/api/users/me/avatar').set('Cookie', u.cookie).attach('avatar', PNG, 'b.png');
    const after = await pool.query('SELECT id FROM imagen_pendiente WHERE usuario_id = $1 AND tipo = $2', [u.user.id, 'avatar']);
    // Sigue habiendo UNA sola fila pendiente (la de A se descartó) y es la más nueva.
    expect(after.rows).toHaveLength(1);
    expect(Number(after.rows[0].id)).toBeGreaterThan(Number(first.rows[0].id));
  });

  test('superseding: si el avatar nuevo es seguro, descarta el pendiente viejo y publica el nuevo', async () => {
    checkImageSafety.mockResolvedValue(LIKELY);
    const u = await registerAndLogin();
    await request(app).patch('/api/users/me/avatar').set('Cookie', u.cookie).attach('avatar', PNG, 'a.png');
    expect((await pool.query('SELECT id FROM imagen_pendiente WHERE usuario_id = $1', [u.user.id])).rows).toHaveLength(1);

    // El segundo avatar esta vez pasa la moderación.
    checkImageSafety.mockResolvedValue({ safe: true });
    const res = await request(app).patch('/api/users/me/avatar').set('Cookie', u.cookie).attach('avatar', PNG, 'b.png');
    expect(res.status).toBe(200);

    // No queda ningún pendiente (la A vieja se limpió aunque la nueva fue segura)
    // y el perfil ya tiene la imagen nueva aplicada.
    const pend = await pool.query('SELECT id FROM imagen_pendiente WHERE usuario_id = $1 AND tipo = $2', [u.user.id, 'avatar']);
    expect(pend.rows).toHaveLength(0);
    const userRows = await pool.query('SELECT url_imagen FROM usuario WHERE id = $1', [u.user.id]);
    expect(userRows.rows[0].url_imagen).not.toBeNull();
  });

  test('respaldo defensivo: aprobar una pendiente ya superada por otra más reciente no toca el perfil', async () => {
    const u = await registerAndLogin();
    // Simulamos el estado "carrera / datos previos al índice": dos filas
    // pendientes del mismo usuario+tipo. Para insertarlas hay que quitar el
    // índice único un momento y recrearlo al final (no filtra a otros tests).
    await pool.query('DROP INDEX IF EXISTS idx_imagen_pendiente_usuario_tipo');
    try {
      const old = await pool.query(
        `INSERT INTO imagen_pendiente (usuario_id, url, public_id, tipo)
         VALUES ($1, $2, $3, 'avatar') RETURNING id`,
        [u.user.id, 'http://old', 'udelarhits/pending/old']
      );
      await pool.query(
        `INSERT INTO imagen_pendiente (usuario_id, url, public_id, tipo)
         VALUES ($1, $2, $3, 'avatar')`,
        [u.user.id, 'http://new', 'udelarhits/pending/new']
      );
      const oldId = old.rows[0].id;

      const admin = await createAdmin();
      const res = await request(app)
        .patch(`/api/admin/pending-images/${oldId}/approve`)
        .set('Cookie', admin.cookie)
        .send({ origen: 'avatar' });

      expect(res.status).toBe(200);
      expect(res.body.data.action).toBe('avatar_obsoleto');

      // El perfil NO se actualizó con la imagen vieja...
      const userRows = await pool.query('SELECT url_imagen FROM usuario WHERE id = $1', [u.user.id]);
      expect(userRows.rows[0].url_imagen).toBeNull();
      // ...y la fila obsoleta se descartó, dejando solo la más reciente pendiente.
      const pend = await pool.query('SELECT id FROM imagen_pendiente WHERE usuario_id = $1 AND tipo = $2', [u.user.id, 'avatar']);
      expect(pend.rows).toHaveLength(1);
    } finally {
      await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS idx_imagen_pendiente_usuario_tipo ON imagen_pendiente(usuario_id, tipo)');
    }
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
    // El autor recibe la notificación de rechazo (además de la de "en revisión").
    expect(await hasNotif(u.user.id, /rechazada/i)).toBe(true);
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

  test('(f) aprobar adjunto → estado publicado + notificación de aprobación', async () => {
    const { author, adjId } = await createPendingAdjunto();
    const admin = await createAdmin();

    const res = await request(app)
      .patch(`/api/admin/pending-images/${adjId}/approve`)
      .set('Cookie', admin.cookie)
      .send({ origen: 'adjunto' });

    expect(res.status).toBe(200);
    expect((await adjuntoRow(adjId)).estado).toBe('publicado');
    // El autor recibe la notificación de aprobación.
    expect(await hasNotif(author.user.id, /aprobada/i)).toBe(true);
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
    // El autor recibe la notificación de rechazo.
    expect(await hasNotif(author.user.id, /rechazada/i)).toBe(true);
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
