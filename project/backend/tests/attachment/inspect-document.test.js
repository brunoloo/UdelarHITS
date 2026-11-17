import { inspectDocument } from '../../src/utils/inspectDocument.js';
import { makeZip, makeDocx, makeXlsx, makePptx } from './zip-fixture.js';

const MB = 1024 * 1024;

const pdf = (cuerpo = '') => Buffer.from(
  `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R ${cuerpo} >>\nendobj\n%%EOF\n`,
  'latin1'
);

const OLE2_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const ole2 = (...directorios) => Buffer.concat([
  OLE2_MAGIC,
  Buffer.alloc(504),
  ...directorios.map((nombre) => Buffer.from(nombre, 'utf16le')),
  Buffer.alloc(64),
]);

// Corre `n` bytes todos los desplazamientos de un ZIP de makeZip, como si llevara
// otro contenido delante.
const desplazar = (zip, n) => {
  const out = Buffer.from(zip);
  const eocd = out.length - 22;
  const inicio = out.readUInt32LE(eocd + 16);
  for (let pos = inicio; pos < eocd; pos += 46 + out.readUInt16LE(pos + 28)) {
    out.writeUInt32LE(out.readUInt32LE(pos + 42) + n, pos + 42);
  }
  out.writeUInt32LE(inicio + n, eocd + 16);
  return out;
};

const limpio = [
  { name: 'apuntes/', data: '' },
  { name: 'apuntes/parcial.pdf', data: '%PDF-1.4' },
  { name: 'apuntes/notas.txt', data: 'hola' },
];

const rechaza = async (buffer, nombre, motivo) => {
  expect(await inspectDocument(buffer, nombre)).toEqual({ ok: false, motivo });
};
const acepta = async (buffer, nombre) => {
  expect(await inspectDocument(buffer, nombre)).toEqual({ ok: true });
};

describe('inspectDocument: ZIP', () => {
  test('ZIP limpio con un pdf y un txt → ok', async () => {
    await acepta(makeZip(limpio), 'apuntes.zip');
  });

  test('la extensión del adjunto no distingue mayúsculas', async () => {
    await acepta(makeZip(limpio), 'APUNTES.ZIP');
  });

  test('con un .exe adentro → rechazado', async () => {
    await rechaza(
      makeZip([...limpio, { name: 'apuntes/instalar.exe', data: 'MZ' }]),
      'apuntes.zip', 'el ZIP contiene archivos ejecutables'
    );
  });

  test('con un .js adentro → rechazado', async () => {
    await rechaza(makeZip([{ name: 'factura.js', data: 'x' }]), 'a.zip', 'el ZIP contiene archivos ejecutables');
  });

  test('todas las extensiones ejecutables están bloqueadas', async () => {
    const exts = ['exe', 'scr', 'com', 'pif', 'bat', 'cmd', 'msi', 'dll', 'cpl', 'jar', 'js', 'jse',
      'vbs', 'vbe', 'wsf', 'wsh', 'hta', 'ps1', 'lnk', 'reg', 'chm', 'scf',
      'msp', 'msc', 'msix', 'appx', 'psm1', 'xll', 'url', 'one', 'apk'];
    for (const ext of exts) {
      await rechaza(makeZip([{ name: `archivo.${ext}`, data: 'x' }]), 'a.zip', 'el ZIP contiene archivos ejecutables');
    }
  });

  test('la extensión de la entrada se compara en minúsculas y por la última', async () => {
    await rechaza(makeZip([{ name: 'FOTO.JPG.EXE', data: 'x' }]), 'a.zip', 'el ZIP contiene archivos ejecutables');
    await rechaza(makeZip([{ name: 'carpeta/.Bat', data: 'x' }]), 'a.zip', 'el ZIP contiene archivos ejecutables');
    // Los puntos y espacios finales se pierden al extraer en Windows.
    await rechaza(makeZip([{ name: 'foto.exe. ', data: 'x' }]), 'a.zip', 'el ZIP contiene archivos ejecutables');
    await rechaza(makeZip([{ name: 'foto.exe\u00a0', data: 'x' }]), 'a.zip', 'el ZIP contiene archivos ejecutables');
    // Lo que sigue a ":" es un flujo alternativo del mismo archivo.
    await rechaza(makeZip([{ name: 'foto.exe:datos.txt', data: 'x' }]), 'a.zip', 'el ZIP contiene archivos ejecutables');
    // Una extensión bloqueada que no es la última no cuenta.
    await acepta(makeZip([{ name: 'resumen.exe.txt', data: 'x' }]), 'a.zip');
  });

  test('las entradas de directorio no cuentan para la regla de extensiones', async () => {
    await acepta(makeZip([{ name: 'proyecto.js/' }, { name: 'proyecto.js/leeme.txt', data: 'x' }]), 'a.zip');
  });

  test('con un Office con macros adentro → rechazado', async () => {
    for (const ext of ['docm', 'xlsm', 'pptm', 'dotm', 'xlam', 'xlsb', 'xltm', 'potm', 'ppsm', 'ppam', 'sldm']) {
      await rechaza(makeZip([{ name: `planilla.${ext}`, data: 'x' }]), 'a.zip', 'el ZIP contiene documentos con macros');
    }
  });

  test('un Office con macros renombrado a .zip → rechazado', async () => {
    await rechaza(
      makeDocx([{ name: 'word/vbaProject.bin', data: 'x' }]),
      'informe.zip', 'el ZIP contiene documentos con macros'
    );
  });

  test('ZIP vacío → rechazado', async () => {
    await rechaza(makeZip([]), 'a.zip', 'el archivo comprimido está vacío');
  });

  test('con otro ZIP pegado delante → rechazado', async () => {
    const malicioso = makeZip([{ name: 'instalar.exe', data: 'MZ' }]);
    // Tal cual: el índice del segundo ya no apunta a sus entradas.
    expect((await inspectDocument(Buffer.concat([malicioso, makeZip(limpio)]), 'a.zip')).ok).toBe(false);
    // Con los desplazamientos corregidos se lee bien, pero no empieza en su primera entrada.
    await rechaza(
      Buffer.concat([malicioso, desplazar(makeZip(limpio), malicioso.length)]),
      'a.zip', 'el archivo comprimido tiene una estructura inesperada'
    );
    // Un ZIP vacío al final no esconde al primero.
    expect((await inspectDocument(Buffer.concat([malicioso, makeZip([])]), 'a.zip')).ok).toBe(false);
  });

  test('con un índice que no termina en el cierre del archivo → rechazado', async () => {
    // El índice real queda huérfano: el cierre apunta a una copia plantada antes.
    const zip = makeZip(limpio);
    const eocd = zip.length - 22;
    const inicio = zip.readUInt32LE(eocd + 16);
    const indice = zip.subarray(inicio, eocd);
    const relleno = Buffer.alloc(64);
    const armado = Buffer.concat([zip.subarray(0, inicio), indice, relleno, zip.subarray(eocd)]);
    await rechaza(armado, 'a.zip', 'el archivo comprimido tiene una estructura inesperada');
  });

  test('con otro contenedor adentro → rechazado', async () => {
    for (const ext of ['zip', 'rar', '7z', 'tar', 'gz', 'cab', 'iso', 'img', 'vhd']) {
      await rechaza(makeZip([{ name: `interno.${ext}`, data: 'x' }]), 'a.zip', 'el ZIP contiene otros archivos comprimidos');
    }
  });

  test('con entradas cifradas → rechazado', async () => {
    await rechaza(
      makeZip([{ name: 'notas.txt', data: 'x' }, { name: 'secreto.txt', data: 'x', encrypted: true }]),
      'a.zip', 'el ZIP está protegido con contraseña'
    );
    await rechaza(makeZip(limpio, { encrypted: true }), 'a.zip', 'el ZIP está protegido con contraseña');
  });

  test('500 entradas → ok; 501 → rechazado', async () => {
    const entradas = (n) => Array.from({ length: n }, (_, i) => ({ name: `f${i}.txt` }));
    await acepta(makeZip(entradas(500)), 'a.zip');
    await rechaza(makeZip(entradas(501)), 'a.zip', 'el ZIP contiene demasiados archivos');
  });

  test('200 MB declarados → ok; más de 200 MB → rechazado', async () => {
    await acepta(makeZip([{ name: 'a.txt', uncompressedSize: 200 * MB }]), 'a.zip');
    await rechaza(
      makeZip([{ name: 'a.txt', uncompressedSize: 200 * MB + 1 }]),
      'a.zip', 'el ZIP ocupa demasiado al descomprimirse'
    );
    // El límite es sobre la suma, no por entrada.
    await rechaza(
      makeZip([{ name: 'a.txt', uncompressedSize: 150 * MB }, { name: 'b.txt', uncompressedSize: 51 * MB }]),
      'a.zip', 'el ZIP ocupa demasiado al descomprimirse'
    );
  });

  test('ZIP corrupto o ilegible → rechazado', async () => {
    const motivo = 'el archivo comprimido no se pudo leer';
    // Solo la firma, sin directorio central.
    await rechaza(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0]), 'a.zip', motivo);
    // Truncado: se pierde el fin del directorio central.
    const valido = makeZip(limpio);
    await rechaza(valido.subarray(0, valido.length - 30), 'a.zip', motivo);
    // Directorio central pisado.
    const roto = Buffer.from(valido);
    roto.fill(0xff, roto.length - 22 - 40, roto.length - 22);
    await rechaza(roto, 'a.zip', motivo);
  });
});

describe('inspectDocument: OOXML', () => {
  test('docx, xlsx y pptx mínimos → ok', async () => {
    await acepta(makeDocx(), 'informe.docx');
    await acepta(makeXlsx(), 'planilla.xlsx');
    await acepta(makePptx(), 'clase.pptx');
  });

  test('sin [Content_Types].xml → rechazado', async () => {
    await rechaza(
      makeZip([{ name: 'word/document.xml', data: '<x/>' }]),
      'informe.docx', 'el archivo no es un documento de Office válido'
    );
  });

  test('sin la parte principal de su tipo → rechazado', async () => {
    const motivo = 'el archivo no es un documento de Office válido';
    await rechaza(makeZip([{ name: '[Content_Types].xml', data: '<Types/>' }]), 'informe.docx', motivo);
    // Un xlsx renombrado a docx no trae word/document.xml.
    await rechaza(makeXlsx(), 'informe.docx', motivo);
    await rechaza(makeDocx(), 'planilla.xlsx', motivo);
    await rechaza(makeDocx(), 'clase.pptx', motivo);
    // Un ZIP cualquiera renombrado.
    await rechaza(makeZip(limpio), 'informe.docx', motivo);
  });

  test('con vbaProject.bin → rechazado', async () => {
    const motivo = 'el documento contiene macros';
    await rechaza(makeDocx([{ name: 'word/vbaProject.bin', data: 'x' }]), 'informe.docx', motivo);
    await rechaza(makeXlsx([{ name: 'xl/VBAPROJECT.BIN', data: 'x' }]), 'planilla.xlsx', motivo);
    await rechaza(makePptx([{ name: 'vbaProject.bin', data: 'x' }]), 'clase.pptx', motivo);
  });

  test('con entradas cifradas → rechazado', async () => {
    await rechaza(
      makeDocx([{ name: 'word/media/image1.png', data: 'x', encrypted: true }]),
      'informe.docx', 'el documento está protegido con contraseña'
    );
  });

  test('OOXML corrupto → rechazado', async () => {
    const valido = makeDocx();
    await rechaza(valido.subarray(0, valido.length - 30), 'informe.docx', 'el archivo comprimido no se pudo leer');
  });
});

describe('inspectDocument: OLE2', () => {
  test('.doc sin proyecto VBA → ok', async () => {
    await acepta(ole2('Root Entry', 'WordDocument'), 'informe.doc');
    await acepta(ole2('Root Entry', 'Workbook'), 'planilla.xls');
  });

  test('.doc con _VBA_PROJECT en UTF-16LE → rechazado', async () => {
    await rechaza(ole2('Root Entry', 'WordDocument', '_VBA_PROJECT'), 'informe.doc', 'el documento contiene macros');
    await rechaza(ole2('Root Entry', '_VBA_PROJECT_CUR'), 'planilla.xls', 'el documento contiene macros');
    await rechaza(ole2('Root Entry', 'PowerPoint Document', '_VBA_PROJECT'), 'clase.ppt', 'el documento contiene macros');
  });

  test('el nombre en ASCII no es una entrada de directorio', async () => {
    const buffer = Buffer.concat([ole2('Root Entry'), Buffer.from('_VBA_PROJECT', 'latin1')]);
    await acepta(buffer, 'informe.doc');
  });
});

describe('inspectDocument: PDF', () => {
  test('PDF simple → ok', async () => {
    await acepta(pdf(), 'apunte.pdf');
    await acepta(Buffer.from('%PDF-1.4\n%binarycontent\n', 'binary'), 'apunte.pdf');
  });

  test('con /JavaScript, /Launch o /EmbeddedFile → rechazado', async () => {
    const motivo = 'el PDF contiene contenido activo';
    await rechaza(pdf('/OpenAction << /S /JavaScript /JS (app.alert(1)) >>'), 'a.pdf', motivo);
    await rechaza(pdf('/OpenAction << /S /Launch /F (cmd.exe) >>'), 'a.pdf', motivo);
    await rechaza(pdf('/Names << /EmbeddedFiles 3 0 R >>'), 'a.pdf', motivo);
    await rechaza(pdf('/Type /EmbeddedFile'), 'a.pdf', motivo);
  });

  test('con el nombre escapado con #xx → rechazado', async () => {
    const motivo = 'el PDF contiene contenido activo';
    await rechaza(pdf('/OpenAction << /S /J#61vaScript /JS (app.alert(1)) >>'), 'a.pdf', motivo);
    await rechaza(pdf('/OpenAction << /S /#4Caunch >>'), 'a.pdf', motivo);
    await rechaza(pdf('/Type /Embedded#46ile'), 'a.pdf', motivo);
    await rechaza(pdf('/S /#4a#61#76#61#53#63#72#69#70#74'), 'a.pdf', motivo);
  });
});

describe('inspectDocument: formato', () => {
  test('lo que no se reconoce no pasa', async () => {
    const motivo = 'el archivo no se pudo analizar';
    await rechaza(Buffer.from('hola mundo'), 'notas.docx', motivo);
    await rechaza(makeZip(limpio), 'apuntes.rar', motivo);
    await rechaza(Buffer.alloc(0), 'vacio.zip', motivo);
  });
});
