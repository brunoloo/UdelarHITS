import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createCategory } from '../helpers.js';

// Buffers con magic numbers válidos/ inválidos. PNG 1x1 real (file-type lo
// reconoce; la firma sola no alcanza).
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64'
);
const pdf = Buffer.from('%PDF-1.4\n%binarycontent\n', 'binary');
const zip = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]);
const exe = Buffer.from([0x4d, 0x5a, 0x90, 0, 0, 0, 0, 0]);

const adjuntosEnBD = async (contenidoId) => {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM adjunto WHERE contenido_id = $1', [contenidoId]);
  return rows[0].n;
};

describe('Adjuntos en comentarios', () => {
  test('crea un comentario con adjuntos y los devuelve en el response', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);

    const res = await request(app).post('/api/replies/create')
      .set('Cookie', a.cookie)
      .field('cuerpo', 'comentario con adjuntos')
      .field('categoria_id', String(cat.id))
      .attach('archivos', png, { filename: 'foto.png', contentType: 'image/png' })
      .attach('archivos', pdf, { filename: 'doc.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(Array.isArray(res.body.data.adjuntos)).toBe(true);
    expect(res.body.data.adjuntos).toHaveLength(2);
    const tipos = res.body.data.adjuntos.map(x => x.tipo).sort();
    expect(tipos).toEqual(['documento', 'imagen']);
    const img = res.body.data.adjuntos.find(x => x.tipo === 'imagen');
    expect(img.nombre_original).toBe('foto.png');
    expect(img.url).toBeTruthy();
    expect(img.tamano).toBeGreaterThan(0);
    // En la BD quedaron persistidos.
    expect(await adjuntosEnBD(res.body.data.contenido_id)).toBe(2);
  });

  test('permite publicar solo con adjunto, sin texto → 201', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const res = await request(app).post('/api/replies/create')
      .set('Cookie', a.cookie)
      .field('categoria_id', String(cat.id))
      .attach('archivos', png, { filename: 'sola.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.data.adjuntos).toHaveLength(1);
  });

  test('sin texto y sin adjuntos → 400', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const res = await request(app).post('/api/replies/create')
      .set('Cookie', a.cookie)
      .field('categoria_id', String(cat.id));
    expect(res.status).toBe(400);
  });

  test('tipo de archivo no permitido (.exe) → 400', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const res = await request(app).post('/api/replies/create')
      .set('Cookie', a.cookie)
      .field('cuerpo', 'malicioso')
      .field('categoria_id', String(cat.id))
      .attach('archivos', exe, { filename: 'virus.exe', contentType: 'application/octet-stream' });
    expect(res.status).toBe(400);
  });

  test('archivo que excede 10 MB → 400', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const big = Buffer.concat([png, Buffer.alloc(11 * 1024 * 1024)]);
    const res = await request(app).post('/api/replies/create')
      .set('Cookie', a.cookie)
      .field('cuerpo', 'pesado')
      .field('categoria_id', String(cat.id))
      .attach('archivos', big, { filename: 'grande.png', contentType: 'image/png' });
    expect(res.status).toBe(400);
  });

  test('más de 3 archivos → 400', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    let req = request(app).post('/api/replies/create')
      .set('Cookie', a.cookie)
      .field('cuerpo', 'demasiados')
      .field('categoria_id', String(cat.id));
    for (let i = 0; i < 4; i++) {
      req = req.attach('archivos', png, { filename: `f${i}.png`, contentType: 'image/png' });
    }
    const res = await req;
    expect(res.status).toBe(400);
  });

  test('el hard delete del comentario borra sus adjuntos de la BD', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const create = await request(app).post('/api/replies/create')
      .set('Cookie', a.cookie)
      .field('cuerpo', 'a borrar')
      .field('categoria_id', String(cat.id))
      .attach('archivos', zip, { filename: 'archivo.zip', contentType: 'application/zip' });
    const id = create.body.data.contenido_id;
    expect(await adjuntosEnBD(id)).toBe(1);

    const del = await request(app).delete(`/api/replies/delete/${id}`).set('Cookie', a.cookie);
    expect(del.status).toBe(200);
    expect(await adjuntosEnBD(id)).toBe(0);
  });

  test('los adjuntos aparecen en la lista de comentarios de la categoría', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    await request(app).post('/api/replies/create')
      .set('Cookie', a.cookie)
      .field('cuerpo', 'con imagen')
      .field('categoria_id', String(cat.id))
      .attach('archivos', png, { filename: 'x.png', contentType: 'image/png' });

    const list = await request(app).get(`/api/replies/category/${cat.id}`).set('Cookie', a.cookie).then(r => r.body.data);
    expect(list[0].adjuntos).toHaveLength(1);
    expect(list[0].adjuntos[0].tipo).toBe('imagen');
  });
});
