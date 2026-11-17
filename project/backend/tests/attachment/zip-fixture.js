import zlib from 'node:zlib';

// Arma en memoria un ZIP mínimo y válido, con las entradas guardadas sin compresión.
//
// entries: [{ name, data?, encrypted?, uncompressedSize? }]
//   - data: Buffer o string (vacío por defecto).
//   - encrypted: marca el bit 0 del flag de propósito general (header local y central)
//     y antepone a los datos el header de 12 bytes del cifrado tradicional.
//   - uncompressedSize: tamaño declarado en el directorio central, sin generar los datos.
//     La entrada se declara como "deflate": en una entrada guardada el tamaño declarado
//     tiene que coincidir con el real.
// opts.encrypted: marca todas las entradas como cifradas.

const VERSION = 20;
const UTF8_FLAG = 0x0800;
const ENCRYPTED_FLAG = 0x0001;
const STORED = 0;
const DEFLATE = 8;
const ENCRYPTION_HEADER = 12;

export const makeZip = (entries = [], opts = {}) => {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8');
    const data = Buffer.from(entry.data ?? '');
    const crc = zlib.crc32(data);
    const encrypted = Boolean(entry.encrypted || opts.encrypted);
    const flags = UTF8_FLAG | (encrypted ? ENCRYPTED_FLAG : 0);
    const stored = encrypted ? Buffer.concat([Buffer.alloc(ENCRYPTION_HEADER), data]) : data;
    const declared = entry.uncompressedSize !== undefined;
    const method = declared ? DEFLATE : STORED;
    const uncompressedSize = declared ? entry.uncompressedSize : data.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(VERSION, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(stored.length, 18);
    local.writeUInt32LE(uncompressedSize, 22);
    local.writeUInt16LE(name.length, 26);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(VERSION, 4);
    central.writeUInt16LE(VERSION, 6);
    central.writeUInt16LE(flags, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(stored.length, 20);
    central.writeUInt32LE(uncompressedSize, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);

    locals.push(local, name, stored);
    centrals.push(central, name);
    offset += local.length + name.length + stored.length;
  }

  const centralDirectory = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return Buffer.concat([...locals, centralDirectory, eocd]);
};

// Documentos OOXML mínimos: alcanzan las partes que exige la inspección.
const ooxml = (parte) => (extra = []) => makeZip([
  { name: '[Content_Types].xml', data: '<Types/>' },
  { name: '_rels/.rels', data: '<Relationships/>' },
  { name: parte, data: '<x/>' },
  ...extra,
]);

export const makeDocx = ooxml('word/document.xml');
export const makeXlsx = ooxml('xl/workbook.xml');
export const makePptx = ooxml('ppt/presentation.xml');
