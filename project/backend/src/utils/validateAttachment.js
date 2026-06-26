import { fileTypeFromBuffer } from 'file-type';

const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// Detecta el tipo de adjunto por sus bytes (magic numbers), igual que avatar/banner.
// Devuelve 'imagen' | 'documento' | null (null = tipo no permitido).
//   - Imágenes (jpg/png/gif/webp) y PDF: por file-type (bytes iniciales).
//   - Office XML (docx/xlsx/pptx) y ZIP: signature ZIP  50 4B
//   - RAR: signature  52 61 72
//   - Office legacy (doc/xls, OLE2): signature  D0 CF 11 E0
export const detectAttachmentType = async (buffer) => {
  if (!buffer || buffer.length < 4) return null;

  const ft = await fileTypeFromBuffer(buffer);
  if (ft) {
    if (IMAGE_MIMES.includes(ft.mime)) return 'imagen';
    if (ft.mime === 'application/pdf') return 'documento';
  }

  const b = buffer;
  if (b[0] === 0x50 && b[1] === 0x4b) return 'documento';                                   // ZIP (docx/xlsx/pptx/zip)
  if (b[0] === 0x52 && b[1] === 0x61 && b[2] === 0x72) return 'documento';                  // RAR  (Rar)
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return 'documento'; // OLE2 (doc/xls)

  return null;
};
