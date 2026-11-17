import yauzl from 'yauzl';
import {
  EXT_EJECUTABLES, EXT_OFFICE_MACROS, EXT_CONTENEDORES, ZIP_LIMITS,
  OOXML_PARTE_PRINCIPAL, OOXML_CONTENT_TYPES, OOXML_VBA, OLE2_VBA, PDF_NOMBRES_BLOQUEADOS,
} from '../config/attachmentRules.js';
import { extensionOf } from './validateAttachment.js';

const OK = { ok: true };
const rechazo = (motivo) => ({ ok: false, motivo });

const baseName = (path) => path.slice(path.lastIndexOf('/') + 1);

// Última extensión de una entrada. Windows descarta los puntos y espacios finales
// al extraer ("a.exe." queda "a.exe") y lo que sigue a ":" es un flujo alternativo
// del mismo archivo, así que no cuentan.
const entryExtension = (fileName) => {
  const name = baseName(fileName).split(':')[0].replace(/[.\s]+$/u, '');
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
};

// Lee el directorio central sin descomprimir nada.
const readZipEntries = (buffer) => new Promise((resolve, reject) => {
  yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
    if (err) return reject(err);
    const entries = [];
    zipfile.on('entry', (entry) => {
      entries.push({
        fileName: entry.fileName,
        encrypted: entry.isEncrypted(),
        uncompressedSize: entry.uncompressedSize,
        offset: entry.relativeOffsetOfLocalHeader,
        // Bytes que ocupa la entrada en el directorio central.
        directorySize: 46 + entry.fileNameLength + entry.extraFieldLength + entry.fileCommentLength,
      });
      zipfile.readEntry();
    });
    zipfile.on('end', () => resolve(entries));
    zipfile.on('error', reject);
    zipfile.readEntry();
  });
});

const EOCD_SIGNATURE = Buffer.from([0x50, 0x4b, 0x05, 0x06]);

// Un ZIP normal empieza con su primera entrada y termina con su índice. Si no, trae otro
// archivo pegado, que algunos descompresores abrirían en lugar del que se inspeccionó.
const hasPlainLayout = (buffer, entries) => {
  const eocd = buffer.lastIndexOf(EOCD_SIGNATURE);
  if (eocd < 0) return false;
  const directoryStart = buffer.readUInt32LE(eocd + 16);
  const directorySize = entries.reduce((sum, e) => sum + e.directorySize, 0);
  return directoryStart + directorySize === eocd && entries.some((e) => e.offset === 0);
};

// Las funciones por formato son puras, para testearlas sin base.
export const inspectZipEntries = (entries) => {
  if (entries.length > ZIP_LIMITS.MAX_ENTRADAS) return rechazo('el ZIP contiene demasiados archivos');
  if (entries.some((e) => e.encrypted)) return rechazo('el ZIP está protegido con contraseña');

  const total = entries.reduce((sum, e) => sum + e.uncompressedSize, 0);
  if (total > ZIP_LIMITS.MAX_DESCOMPRIMIDO) return rechazo('el ZIP ocupa demasiado al descomprimirse');

  for (const { fileName } of entries) {
    if (fileName.endsWith('/')) continue;
    const ext = entryExtension(fileName);
    if (EXT_EJECUTABLES.has(ext)) return rechazo('el ZIP contiene archivos ejecutables');
    if (EXT_OFFICE_MACROS.has(ext)) return rechazo('el ZIP contiene documentos con macros');
    if (EXT_CONTENEDORES.has(ext)) return rechazo('el ZIP contiene otros archivos comprimidos');
    // Un Office con macros renombrado a .zip.
    if (baseName(fileName).toLowerCase() === OOXML_VBA.toLowerCase()) {
      return rechazo('el ZIP contiene documentos con macros');
    }
  }
  return OK;
};

export const inspectOoxmlEntries = (entries, ext) => {
  // Los nombres de las partes de un OOXML no distinguen mayúsculas.
  const names = new Set(entries.map((e) => e.fileName.toLowerCase()));
  const principal = OOXML_PARTE_PRINCIPAL[ext];
  if (!principal || !names.has(OOXML_CONTENT_TYPES.toLowerCase()) || !names.has(principal.toLowerCase())) {
    return rechazo('el archivo no es un documento de Office válido');
  }
  if (entries.some((e) => e.encrypted)) return rechazo('el documento está protegido con contraseña');
  if ([...names].some((name) => baseName(name) === OOXML_VBA.toLowerCase())) {
    return rechazo('el documento contiene macros');
  }
  return OK;
};

// Best-effort: no detecta macros de Excel 4.0 ni VBA en .ppt.
export const inspectOle2 = (buffer) => {
  return buffer.includes(Buffer.from(OLE2_VBA, 'utf16le'))
    ? rechazo('el documento contiene macros')
    : OK;
};

// Un nombre PDF puede escribir cualquier carácter como #xx (/J#61vaScript): cada letra
// se busca también en esa forma.
const pdfNamePattern = (nombre) => '/' + [...nombre.slice(1)].map((c) => {
  const hex = c.charCodeAt(0).toString(16).padStart(2, '0')
    .replace(/[a-f]/g, (d) => `[${d}${d.toUpperCase()}]`);
  return `(?:${c}|#${hex})`;
}).join('');

const PDF_BLOQUEADOS_RE = new RegExp(PDF_NOMBRES_BLOQUEADOS.map(pdfNamePattern).join('|'));

// Best-effort: no ve los nombres que viajan dentro de streams comprimidos.
export const inspectPdf = (buffer) => {
  return PDF_BLOQUEADOS_RE.test(buffer.toString('latin1'))
    ? rechazo('el PDF contiene contenido activo')
    : OK;
};

const startsWith = (buffer, bytes) => bytes.every((b, i) => buffer[i] === b);

// Mismo criterio que validateAttachment: bytes iniciales + extensión.
const formatOf = (buffer, ext) => {
  if (startsWith(buffer, [0x50, 0x4b])) {
    if (ext === 'zip') return 'zip';
    return Object.hasOwn(OOXML_PARTE_PRINCIPAL, ext) ? 'ooxml' : null;
  }
  if (startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0])) return 'ole2';
  if (ext === 'pdf' || startsWith(buffer, [0x25, 0x50, 0x44, 0x46])) return 'pdf';
  return null;
};

// Inspecciona un documento ya validado por detectAttachmentType.
// Devuelve { ok: true } | { ok: false, motivo }, con `motivo` listo para mostrar al usuario.
export const inspectDocument = async (buffer, originalname = '') => {
  if (!buffer || buffer.length < 4) return rechazo('el archivo no se pudo analizar');

  const ext = extensionOf(originalname);
  const format = formatOf(buffer, ext);

  if (format === 'zip' || format === 'ooxml') {
    let entries;
    try {
      entries = await readZipEntries(buffer);
    } catch {
      // Lo que no se puede leer no se publica.
      return rechazo('el archivo comprimido no se pudo leer');
    }
    if (entries.length === 0) return rechazo('el archivo comprimido está vacío');
    if (!hasPlainLayout(buffer, entries)) {
      return rechazo('el archivo comprimido tiene una estructura inesperada');
    }
    return format === 'zip' ? inspectZipEntries(entries) : inspectOoxmlEntries(entries, ext);
  }
  if (format === 'ole2') return inspectOle2(buffer);
  if (format === 'pdf') return inspectPdf(buffer);
  return rechazo('el archivo no se pudo analizar');
};
