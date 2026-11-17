// Lista los documentos adjuntos ya publicados que la inspección actual rechazaría.
// Solo lectura: descarga cada archivo y lo analiza, sin borrar ni modificar nada.
import '../src/config/env.js';
import pool from '../src/config/db.js';
import { getDocumentAttachments } from '../src/repositories/adjunto.repository.js';
import { inspectDocument } from '../src/utils/inspectDocument.js';
import { extensionOf } from '../src/utils/validateAttachment.js';

const DOWNLOAD_TIMEOUT_MS = 30_000;

const download = async (url) => {
  const res = await fetch(url, { signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
};

// Devuelve el motivo por el que hoy se rechazaría el adjunto, o null si pasa.
const motivoDeRechazo = async (adjunto) => {
  if (extensionOf(adjunto.nombre_original) === 'rar') return 'formato ya no admitido';
  const buffer = await download(adjunto.url);
  const inspeccion = await inspectDocument(buffer, adjunto.nombre_original);
  return inspeccion.ok ? null : inspeccion.motivo;
};

const linea = (adjunto, detalle) =>
  `  id ${adjunto.id} · contenido ${adjunto.contenido_id} · ${adjunto.nombre_original} · ${detalle}`;

async function main() {
  const adjuntos = await getDocumentAttachments();
  const rechazados = [];
  const fallidos = [];

  for (const adjunto of adjuntos) {
    try {
      const motivo = await motivoDeRechazo(adjunto);
      if (motivo) rechazados.push(linea(adjunto, motivo));
    } catch (error) {
      fallidos.push(linea(adjunto, error.message));
    }
  }

  console.log(`Documentos adjuntos analizados: ${adjuntos.length}`);
  if (rechazados.length) {
    console.log('\nHoy serían rechazados:');
    rechazados.forEach((l) => console.log(l));
  }
  if (fallidos.length) {
    console.log('\nNo se pudieron descargar:');
    fallidos.forEach((l) => console.log(l));
  }
  console.log(`\nTotal: ${rechazados.length} rechazados, ${fallidos.length} sin analizar, de ${adjuntos.length} documentos.`);
}

main()
  .catch((error) => {
    console.error(`No se pudo completar la auditoría: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
