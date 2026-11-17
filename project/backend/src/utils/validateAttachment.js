import { fileTypeFromBuffer } from 'file-type';

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Extensiones admitidas según el contenido real del archivo. El nombre original
// define el nombre de descarga, así que no puede declarar un formato distinto.
const DOCUMENT_EXTENSIONS = {
  pdf: ['pdf'],
  zip: ['docx', 'xlsx', 'pptx', 'zip'],
  ole2: ['doc', 'xls', 'ppt'],
};

export const extensionOf = (name = '') => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
};

const documentFormat = (buffer, mime) => {
  if (mime === 'application/pdf') return 'pdf';
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) return 'zip';
  if (buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0) return 'ole2';
  return null;
};

// Devuelve 'imagen' | 'documento' | null (tipo no permitido). El tipo se decide
// por los bytes iniciales, no por el mimetype que declara el cliente.
export const detectAttachmentType = async (buffer, originalname = '') => {
  if (!buffer || buffer.length < 4) return null;

  const detected = await fileTypeFromBuffer(buffer);
  if (detected && IMAGE_MIMES.includes(detected.mime)) return 'imagen';

  const format = documentFormat(buffer, detected?.mime);
  if (!format) return null;
  return DOCUMENT_EXTENSIONS[format].includes(extensionOf(originalname)) ? 'documento' : null;
};
