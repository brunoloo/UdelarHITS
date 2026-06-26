import { jest } from '@jest/globals';

// Mock del wrapper de Cloudinary ANTES de importar la app.
// Evita tocar la red: la "subida" devuelve una URL falsa, el "borrado" no hace nada.
jest.unstable_mockModule('../../src/utils/uploadToCloudinary.js', () => ({
  uploadToCloudinary: jest.fn(async (buffer, folder, publicId) =>
    `https://fake.cloudinary/${folder}/${publicId}.png`
  ),
  deleteFromCloudinary: jest.fn(async () => ({ result: 'ok' })),
  uploadAttachment: jest.fn(async (buffer, tipo) => ({
    url: `https://fake.cloudinary/adjuntos/${tipo}.bin`,
    public_id: `udelarhits/adjuntos/fake_${Math.random().toString(36).slice(2)}`,
  })),
  deleteAttachmentFromCloudinary: jest.fn(async () => ({ result: 'ok' })),
}));

const pool = (await import('../../src/config/db.js')).default;
const { uploadToCloudinary, deleteFromCloudinary } = await import('../../src/utils/uploadToCloudinary.js');
const request = (await import('supertest')).default;
const app = (await import('../../src/app.js')).default;
const { registerAndLogin } = await import('../helpers.js');

// PNG 1x1 transparente real — fileTypeFromBuffer lo reconoce como image/png
const PNG_VALIDO = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64'
);

// bytes mágicos de un PNG real (firma de 8 bytes) + relleno
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const NO_IMAGEN = Buffer.from('esto es texto plano, no una imagen');

describe('subida de avatar — validación de magic numbers', () => {
  test('un archivo que NO es imagen (aunque diga .png) → 400', async () => {
    const u = await registerAndLogin();
    const res = await request(app)
      .patch('/api/users/me/avatar')
      .set('Cookie', u.cookie)
      .attach('avatar', NO_IMAGEN, 'foto.png');   // nombre engañoso
    expect(res.status).toBe(400);
  });

  test('sin archivo → 400', async () => {
    const u = await registerAndLogin();
    const res = await request(app)
      .patch('/api/users/me/avatar')
      .set('Cookie', u.cookie);
    expect(res.status).toBe(400);
  });
});

const urlImagenEnBD = async (userId) => {
  const { rows } = await pool.query('SELECT url_imagen FROM usuario WHERE id = $1', [userId]);
  return rows[0]?.url_imagen ?? null;
};

describe('subida y borrado de avatar — flujo válido', () => {
  test('subir un PNG válido → 200 y persiste la URL', async () => {
    const u = await registerAndLogin();
    const res = await request(app)
      .patch('/api/users/me/avatar')
      .set('Cookie', u.cookie)
      .attach('avatar', PNG_VALIDO, 'foto.png');
    expect(res.status).toBe(200);
    // la URL (la falsa del mock) quedó guardada en la BD
    expect(await urlImagenEnBD(u.user.id)).toContain('fake.cloudinary');
  });

  test('la subida usa public_id determinístico (no acumula) → avatar_<userId>', async () => {
    const u = await registerAndLogin();
    uploadToCloudinary.mockClear();
    await request(app)
      .patch('/api/users/me/avatar')
      .set('Cookie', u.cookie)
      .attach('avatar', PNG_VALIDO, 'foto.png');
    // se llamó con folder 'avatars' y public_id 'avatar_<userId>'
    expect(uploadToCloudinary).toHaveBeenCalledWith(
      expect.any(Buffer), 'avatars', `avatar_${u.user.id}`
    );
  });

  test('eliminar avatar → llama a deleteFromCloudinary y deja url_imagen en null', async () => {
    const u = await registerAndLogin();
    // primero subir uno
    await request(app).patch('/api/users/me/avatar')
      .set('Cookie', u.cookie).attach('avatar', PNG_VALIDO, 'foto.png');
    expect(await urlImagenEnBD(u.user.id)).not.toBeNull();

    deleteFromCloudinary.mockClear();
    const res = await request(app).delete('/api/users/me/avatar').set('Cookie', u.cookie);
    expect(res.status).toBe(200);
    expect(deleteFromCloudinary).toHaveBeenCalled();
    expect(await urlImagenEnBD(u.user.id)).toBeNull();
  });
});

// PNG válido pero MÁS grande que el límite de 2MB (firma real + relleno)
const PNG_GRANDE_AVATAR = Buffer.concat([
  PNG_VALIDO,
  Buffer.alloc(2 * 1024 * 1024 + 1000), // empuja el total por encima de 2MB
]);

describe('subida de avatar — límite de peso (2MB)', () => {
  test('un archivo que excede 2MB → 400 (cortado por Multer, no llega a subir)', async () => {
    const u = await registerAndLogin();
    uploadToCloudinary.mockClear();
    const res = await request(app)
      .patch('/api/users/me/avatar')
      .set('Cookie', u.cookie)
      .attach('avatar', PNG_GRANDE_AVATAR, 'enorme.png');
    expect(res.status).toBe(400);
    // clave: Multer lo cortó ANTES de subir → el wrapper nunca se llamó
    expect(uploadToCloudinary).not.toHaveBeenCalled();
  });
});