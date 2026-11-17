// Reglas de inspección de los documentos adjuntos (ver utils/inspectDocument.js).
// Las extensiones van en minúsculas y sin punto.

// Ejecutables y scripts que no pueden viajar dentro de un ZIP.
export const EXT_EJECUTABLES = new Set([
  'exe', 'scr', 'com', 'pif', 'bat', 'cmd', 'msi', 'dll', 'cpl', 'jar',
  'js', 'jse', 'vbs', 'vbe', 'wsf', 'wsh', 'hta', 'ps1', 'lnk', 'reg', 'chm', 'scf',
  'msp', 'msc', 'msix', 'appx', 'psm1', 'xll', 'url', 'one', 'apk',
]);

// Formatos de Office que admiten macros.
export const EXT_OFFICE_MACROS = new Set([
  'docm', 'xlsm', 'pptm', 'dotm', 'xlam',
  'xlsb', 'xltm', 'potm', 'ppsm', 'ppam', 'sldm',
]);

// Contenedores anidados: esconderían su contenido de la inspección.
export const EXT_CONTENEDORES = new Set([
  'zip', 'rar', '7z', 'tar', 'gz', 'cab', 'iso', 'img', 'vhd',
]);

export const ZIP_LIMITS = {
  MAX_ENTRADAS: 500,
  // Suma de los tamaños declarados en el directorio central.
  MAX_DESCOMPRIMIDO: 200 * 1024 * 1024,
};

// Parte principal que define a cada tipo de documento OOXML.
export const OOXML_PARTE_PRINCIPAL = {
  docx: 'word/document.xml',
  xlsx: 'xl/workbook.xml',
  pptx: 'ppt/presentation.xml',
};

export const OOXML_CONTENT_TYPES = '[Content_Types].xml';

// Nombre base de la parte que guarda un proyecto VBA en un OOXML.
export const OOXML_VBA = 'vbaProject.bin';

// Nombre de directorio del proyecto VBA en un documento OLE2 (.doc/.xls).
export const OLE2_VBA = '_VBA_PROJECT';

// Nombres PDF que indican contenido activo o archivos embebidos.
export const PDF_NOMBRES_BLOQUEADOS = ['/Launch', '/JavaScript', '/EmbeddedFile'];
