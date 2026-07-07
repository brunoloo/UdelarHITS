import { jest } from '@jest/globals';

// Defensa 4: cuota de Cloudinary superada — error honesto en avatar/banner y
// comentario que se publica igual (con advertencia) cuando fallan los adjuntos.
//
// Mock del wrapper ANTES de importar la app (mismo patrón que tests/upload).
// El wrapper real clasifica el error crudo de Cloudinary y lo relanza con
// code CLOUDINARY_QUOTA; acá simulamos directamente ese error clasificado.
const quotaError = () => {
  const err = new Error('Almacenamiento temporalmente no disponible (cuota del proveedor superada)');
  err.code = 'CLOUDINARY_QUOTA';
  return err;
};

jest.unstable_mockModule('../../src/utils/uploadToCloudinary.js', () => ({
  uploadToCloudinary: jest.fn(async () => { throw quotaError(); }),
  deleteFromCloudinary: jest.fn(async () => ({ result: 'ok' })),
  uploadAttachment: jest.fn(async () => { throw quotaError(); }),
  deleteAttachmentFromCloudinary: jest.fn(async () => ({ result: 'ok' })),
  isCloudinaryQuotaError: jest.fn(),
}));

const { uploadAttachment } = await import('../../src/utils/uploadToCloudinary.js');
const request = (await import('supertest')).default;
const app = (await import('../../src/app.js')).default;
const pool = (await import('../../src/config/db.js')).default;
const { registerAndLogin, createTopic } = await import('../helpers.js');

// PNG 1x1 real (magic numbers válidos).
const PNG_VALIDO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64'
);

describe('cuota de Cloudinary superada — avatar y banner', () => {
  test('avatar → 503 con mensaje específico (no un 500 genérico)', async () => {
    const u = await registerAndLogin();
    const res = await request(app)
      .patch('/api/users/me/avatar')
      .set('Cookie', u.cookie)
      .attach('avatar', PNG_VALIDO, 'foto.png');
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/problema temporal de almacenamiento/i);
    expect(res.body.message).toMatch(/resto del foro sigue funcionando/i);
  });

  test('banner → 503 con mensaje específico', async () => {
    const u = await registerAndLogin();
    const res = await request(app)
      .patch('/api/users/me/banner')
      .set('Cookie', u.cookie)
      .attach('banner', PNG_VALIDO, 'banner.png');
    expect(res.status).toBe(503);
    expect(res.body.message).toMatch(/problema temporal de almacenamiento/i);
  });
});

describe('cuota de Cloudinary superada — adjuntos de comentario', () => {
  test('el comentario se publica igual (201) con advertencia y sin adjuntos', async () => {
    const u = await registerAndLogin();
    const topic = await createTopic(u.cookie);
    const temaId = topic.id ?? topic.contenido_id;

    const res = await request(app)
      .post('/api/replies/create')
      .set('Cookie', u.cookie)
      .field('cuerpo', 'comentario con adjunto que no va a subir')
      .field('tema_id', String(temaId))
      .attach('archivos', PNG_VALIDO, 'foto.png');

    expect(res.status).toBe(201);
    expect(res.body.data.adjuntos).toEqual([]);
    expect(res.body.data.advertencia).toMatch(/se publicó.*no se pudieron subir|no se pudieron subir/i);
    expect(res.body.data.advertencia).toMatch(/no es un error tuyo/i);

    // El comentario quedó persistido de verdad.
    const { rows } = await pool.query(
      'SELECT id FROM contenido WHERE id = $1', [res.body.data.contenido_id]
    );
    expect(rows.length).toBe(1);
  });

  test('fallo parcial: los adjuntos que subieron se conservan', async () => {
    const u = await registerAndLogin();
    const topic = await createTopic(u.cookie);
    const temaId = topic.id ?? topic.contenido_id;

    // El primero sube bien, el segundo cae por cuota.
    uploadAttachment
      .mockImplementationOnce(async () => ({
        url: 'https://fake.cloudinary/adjuntos/ok.png',
        public_id: 'udelarhits/adjuntos/ok',
      }))
      .mockImplementationOnce(async () => { throw quotaError(); });

    const res = await request(app)
      .post('/api/replies/create')
      .set('Cookie', u.cookie)
      .field('cuerpo', 'dos adjuntos, uno cae')
      .field('tema_id', String(temaId))
      .attach('archivos', PNG_VALIDO, 'ok.png')
      .attach('archivos', PNG_VALIDO, 'falla.png');

    expect(res.status).toBe(201);
    expect(res.body.data.adjuntos.length).toBe(1);
    expect(res.body.data.advertencia).toBeDefined();
  });
});

