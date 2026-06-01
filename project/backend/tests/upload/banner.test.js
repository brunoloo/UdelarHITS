import { jest } from '@jest/globals';

// Mock del wrapper de Cloudinary ANTES de cualquier import
jest.unstable_mockModule('../../src/utils/uploadToCloudinary.js', () => ({
  uploadToCloudinary: jest.fn(async (buffer, folder, publicId) =>
    `https://fake.cloudinary/${folder}/${publicId}.png`
  ),
  deleteFromCloudinary: jest.fn(async () => ({ result: 'ok' })),
}));

const pool = (await import('../../src/config/db.js')).default;
const { uploadToCloudinary, deleteFromCloudinary } = await import('../../src/utils/uploadToCloudinary.js');
const request = (await import('supertest')).default;
const app = (await import('../../src/app.js')).default;
const { registerAndLogin } = await import('../helpers.js');

const PNG_VALIDO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64'
);
const NO_IMAGEN = Buffer.from('esto es texto plano, no una imagen');

const urlBannerEnBD = async (userId) => {
  const { rows } = await pool.query('SELECT url_banner FROM usuario WHERE id = $1', [userId]);
  return rows[0]?.url_banner ?? null;
};

describe('subida de banner — validación de magic numbers', () => {
  test('un archivo que NO es imagen → 400', async () => {
    const u = await registerAndLogin();
    const res = await request(app)
      .patch('/api/users/me/banner')
      .set('Cookie', u.cookie)
      .attach('banner', NO_IMAGEN, 'banner.png');
    expect(res.status).toBe(400);
  });

  test('sin archivo → 400', async () => {
    const u = await registerAndLogin();
    const res = await request(app)
      .patch('/api/users/me/banner')
      .set('Cookie', u.cookie);
    expect(res.status).toBe(400);
  });
});

describe('subida y borrado de banner — flujo válido', () => {
  test('subir un PNG válido → 200 y persiste la URL', async () => {
    const u = await registerAndLogin();
    const res = await request(app)
      .patch('/api/users/me/banner')
      .set('Cookie', u.cookie)
      .attach('banner', PNG_VALIDO, 'banner.png');
    expect(res.status).toBe(200);
    expect(await urlBannerEnBD(u.user.id)).toContain('fake.cloudinary');
  });

  test('usa public_id determinístico → banner_<userId>', async () => {
    const u = await registerAndLogin();
    uploadToCloudinary.mockClear();
    await request(app)
      .patch('/api/users/me/banner')
      .set('Cookie', u.cookie)
      .attach('banner', PNG_VALIDO, 'banner.png');
    expect(uploadToCloudinary).toHaveBeenCalledWith(
      expect.any(Buffer), 'banners', `banner_${u.user.id}`
    );
  });

  test('eliminar banner → llama a deleteFromCloudinary y deja url_banner en null', async () => {
    const u = await registerAndLogin();
    await request(app).patch('/api/users/me/banner')
      .set('Cookie', u.cookie).attach('banner', PNG_VALIDO, 'banner.png');
    expect(await urlBannerEnBD(u.user.id)).not.toBeNull();

    deleteFromCloudinary.mockClear();
    const res = await request(app).delete('/api/users/me/banner').set('Cookie', u.cookie);
    expect(res.status).toBe(200);
    expect(deleteFromCloudinary).toHaveBeenCalled();
    expect(await urlBannerEnBD(u.user.id)).toBeNull();
  });
});

const PNG_GRANDE_BANNER = Buffer.concat([
  PNG_VALIDO,
  Buffer.alloc(3 * 1024 * 1024 + 1000), // por encima de 3MB
]);

describe('subida de banner — límite de peso (3MB)', () => {
  test('un archivo que excede 3MB → 400 (cortado por Multer)', async () => {
    const u = await registerAndLogin();
    uploadToCloudinary.mockClear();
    const res = await request(app)
      .patch('/api/users/me/banner')
      .set('Cookie', u.cookie)
      .attach('banner', PNG_GRANDE_BANNER, 'enorme.png');
    expect(res.status).toBe(400);
    expect(uploadToCloudinary).not.toHaveBeenCalled();
  });
});