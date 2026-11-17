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
// al extraer ("a.exe." queda "a.exe"), así que no cuentan.
const entryExtension = (fileName) => {
  const name = baseName(fileName).replace(/[. ]+$/, '');
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
      });
      zipfile.readEntry();
    });
    zipfile.on('end', () => resolve(entries));
    zipfile.on('error', reject);
    zipfile.readEntry();
  });
});

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

// Best-effort: no ve los nombres que viajan dentro de streams comprimidos.
export const inspectPdf = (buffer) => {
  // Un nombre PDF puede escribir cualquier carácter como #xx (/J#61vaScript).
  const text = buffer.toString('latin1')
    .replace(/#([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  return PDF_NOMBRES_BLOQUEADOS.some((nombre) => text.includes(nombre))
    ? rechazo('el PDF contiene contenido activo')
    : OK;
};

const startsWith = (buffer, bytes) => bytes.every((b, i) => buffer[i] === b);

// Mismo criterio que validateAttachment: bytes iniciales + extensión.
const formatOf = (buffer, ext) => {
  if (startsWith(buffer, [0x50, 0x4b])) {
    if (ext === 'zip') return 'zip';
    return ext in OOXML_PARTE_PRINCIPAL ? 'ooxml' : null;
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
    return format === 'zip' ? inspectZipEntries(entries) : inspectOoxmlEntries(entries, ext);
  }
  if (format === 'ole2') return inspectOle2(buffer);
  if (format === 'pdf') return inspectPdf(buffer);
  return rechazo('el archivo no se pudo analizar');
};
