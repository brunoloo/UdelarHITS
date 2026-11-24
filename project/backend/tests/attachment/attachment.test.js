import request from 'supertest';
import app from '../../src/app.js';
import pool from '../../src/config/db.js';
import { registerAndLogin, createCategory } from '../helpers.js';
import { makeZip, makeDocx } from './zip-fixture.js';
import { getDocumentAttachments } from '../../src/repositories/adjunto.repository.js';
import { createReply } from '../../src/controllers/reply.controller.js';
import { ATTACHMENT_LIMITS } from '../../src/config/attachmentRules.js';

// PNG real de 1x1: la firma sola no alcanza para que se reconozca el tipo.
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64'
);
const pdf = Buffer.from('%PDF-1.4\n%binarycontent\n', 'binary');
// ZIP real: los documentos se inspeccionan y uno ilegible se rechaza.
const zip = makeZip([
  { name: 'apuntes/parcial.pdf', data: pdf },
  { name: 'apuntes/notas.txt', data: 'notas' },
]);
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

  test('conserva tildes, ñ y emojis en el nombre original', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const nombre = 'Apuntes de teórico – año 1 📘.pdf';

    const res = await request(app).post('/api/replies/create')
      .set('Cookie', a.cookie)
      .field('cuerpo', 'nombre con tildes')
      .field('categoria_id', String(cat.id))
      .attach('archivos', pdf, { filename: nombre, contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(res.body.data.adjuntos[0].nombre_original).toBe(nombre);
    const { rows } = await pool.query(
      'SELECT nombre_original FROM adjunto WHERE contenido_id = $1', [res.body.data.contenido_id]
    );
    expect(rows[0].nombre_original).toBe(nombre);
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

  test('contenido válido con una extensión que no le corresponde → 400', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const casos = [
      [zip, 'instalador.apk'],
      [zip, 'pagina.html'],
      [pdf, 'documento.exe'],
      [zip, 'sin_extension'],
    ];
    for (const [buffer, filename] of casos) {
      const res = await request(app).post('/api/replies/create')
        .set('Cookie', a.cookie)
        .field('cuerpo', 'extensión engañosa')
        .field('categoria_id', String(cat.id))
        .attach('archivos', buffer, { filename, contentType: 'application/octet-stream' });
      expect(res.status).toBe(400);
    }
  });

  test('ZIP limpio → 201', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const res = await request(app).post('/api/replies/create')
      .set('Cookie', a.cookie)
      .field('cuerpo', 'apuntes')
      .field('categoria_id', String(cat.id))
      .attach('archivos', zip, { filename: 'apuntes.zip', contentType: 'application/zip' });
    expect(res.status).toBe(201);
    expect(res.body.data.adjuntos).toHaveLength(1);
    expect(res.body.data.adjuntos[0].tipo).toBe('documento');
    expect(res.body.data.adjuntos[0].nombre_original).toBe('apuntes.zip');
  });

  test('ZIP con un .exe adentro → 400 con el motivo', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const conExe = makeZip([
      { name: 'apuntes/notas.txt', data: 'notas' },
      { name: 'apuntes/instalar.exe', data: exe },
    ]);
    const res = await request(app).post('/api/replies/create')
      .set('Cookie', a.cookie)
      .field('cuerpo', 'apuntes')
      .field('categoria_id', String(cat.id))
      .attach('archivos', conExe, { filename: 'apuntes.zip', contentType: 'application/zip' });
    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.message).toBe('apuntes.zip: el ZIP contiene archivos ejecutables');
    // No se publicó nada.
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM adjunto');
    expect(rows[0].n).toBe(0);
  });

  test('ZIP ilegible → 400', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const res = await request(app).post('/api/replies/create')
      .set('Cookie', a.cookie)
      .field('cuerpo', 'roto')
      .field('categoria_id', String(cat.id))
      .attach('archivos', Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]), { filename: 'roto.zip', contentType: 'application/zip' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('roto.zip: el archivo comprimido no se pudo leer');
  });

  test('un .rar ya no se admite → 400', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const rar = Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00, 0, 0, 0, 0]);
    const res = await request(app).post('/api/replies/create')
      .set('Cookie', a.cookie)
      .field('cuerpo', 'comprimido')
      .field('categoria_id', String(cat.id))
      .attach('archivos', rar, { filename: 'apuntes.rar', contentType: 'application/vnd.rar' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Tipo de archivo no permitido: apuntes.rar');
  });

  test('docx válido → 201; docx con vbaProject.bin → 400', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const docxMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    const ok = await request(app).post('/api/replies/create')
      .set('Cookie', a.cookie)
      .field('cuerpo', 'informe')
      .field('categoria_id', String(cat.id))
      .attach('archivos', makeDocx(), { filename: 'informe.docx', contentType: docxMime });
    expect(ok.status).toBe(201);

    const conMacros = makeDocx([{ name: 'word/vbaProject.bin', data: 'vba' }]);
    const res = await request(app).post('/api/replies/create')
      .set('Cookie', a.cookie)
      .field('cuerpo', 'informe')
      .field('categoria_id', String(cat.id))
      .attach('archivos', conMacros, { filename: 'informe.docx', contentType: docxMime });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('informe.docx: el documento contiene macros');
  });

  test('un documento rechazado descarta el comentario entero', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const res = await request(app).post('/api/replies/create')
      .set('Cookie', a.cookie)
      .field('cuerpo', 'mezcla')
      .field('categoria_id', String(cat.id))
      .attach('archivos', png, { filename: 'foto.png', contentType: 'image/png' })
      .attach('archivos', Buffer.from('%PDF-1.4\n<< /S /JavaScript /JS (app.alert(1)) >>\n', 'binary'), { filename: 'activo.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('activo.pdf: el PDF contiene contenido activo');
    const list = await request(app).get(`/api/replies/category/${cat.id}`).set('Cookie', a.cookie).then(r => r.body.data);
    expect(list).toHaveLength(0);
  });

  test('la auditoría recorre solo los documentos, en orden', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const create = await request(app).post('/api/replies/create')
      .set('Cookie', a.cookie)
      .field('cuerpo', 'varios')
      .field('categoria_id', String(cat.id))
      .attach('archivos', png, { filename: 'foto.png', contentType: 'image/png' })
      .attach('archivos', pdf, { filename: 'doc.pdf', contentType: 'application/pdf' })
      .attach('archivos', zip, { filename: 'apuntes.zip', contentType: 'application/zip' });
    expect(create.status).toBe(201);

    const documentos = await getDocumentAttachments();
    expect(documentos.map(d => d.nombre_original)).toEqual(['doc.pdf', 'apuntes.zip']);
    expect(Number(documentos[0].contenido_id)).toBe(Number(create.body.data.contenido_id));
    expect(documentos[0].url).toBeTruthy();
    expect(documentos[0].tamano).toBe(pdf.length);
    expect(documentos[0].fecha_creacion).toBeInstanceOf(Date);
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

  test('más de 10 archivos → 400', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    let req = request(app).post('/api/replies/create')
      .set('Cookie', a.cookie)
      .field('cuerpo', 'demasiados')
      .field('categoria_id', String(cat.id));
    for (let i = 0; i < 11; i++) {
      req = req.attach('archivos', png, { filename: `f${i}.png`, contentType: 'image/png' });
    }
    const res = await req;
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Máximo 10 archivos por comentario');
  });

  test('10 archivos → 201', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    let req = request(app).post('/api/replies/create')
      .set('Cookie', a.cookie)
      .field('cuerpo', 'justo el máximo')
      .field('categoria_id', String(cat.id));
    for (let i = 0; i < 10; i++) {
      req = req.attach('archivos', png, { filename: `f${i}.png`, contentType: 'image/png' });
    }
    const res = await req;
    expect(res.status).toBe(201);
    expect(res.body.data.adjuntos).toHaveLength(10);
    expect(await adjuntosEnBD(res.body.data.contenido_id)).toBe(10);
  });

  test('más de 50 MB en total → 400', async () => {
    const a = await registerAndLogin();
    const cat = await createCategory(a.cookie);
    const casiTope = Buffer.concat([png, Buffer.alloc(9 * 1024 * 1024)]);
    let req = request(app).post('/api/replies/create')
      .set('Cookie', a.cookie)
      .field('cuerpo', 'muy pesado')
      .field('categoria_id', String(cat.id));
    for (let i = 0; i < 6; i++) {
      req = req.attach('archivos', casiTope, { filename: `g${i}.png`, contentType: 'image/png' });
    }
    const res = await req;
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Los archivos pueden pesar hasta 50 MB en total por comentario');
  });

  test('sin Content-Length, el controller también aplica el tope total', async () => {
    // Simula lo que deja multer en un envío chunked: la suma real supera el tope.
    const req = {
      body: { cuerpo: 'chunked', categoria_id: '1' },
      user: { id: 1 },
      files: Array.from({ length: 6 }, (_, i) => ({
        buffer: png, originalname: `c${i}.png`, size: 9 * 1024 * 1024,
      })),
    };
    expect(6 * 9 * 1024 * 1024).toBeGreaterThan(ATTACHMENT_LIMITS.MAX_TOTAL);
    const res = { status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await createReply(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.message).toBe('Los archivos pueden pesar hasta 50 MB en total por comentario');
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
