// El placeholder de contenido moderado lo dibuja el cliente, pero el texto, el
// autor y los adjuntos no deben salir del servidor.

const HIDDEN_COMMENT_FIELDS = [
  'cuerpo', 'autor_id', 'autor_nickname', 'autor_url_imagen', 'autor_facultad',
  'autor_estado', 'mi_reaccion', 'encuesta',
];

export const redactAttachments = (adjuntos) => {
  if (!Array.isArray(adjuntos)) return adjuntos;
  return adjuntos.map((a) =>
    a.estado === 'publicado' ? a : { ...a, url: null, nombre_original: null }
  );
};

export const redactComment = (row) => {
  if (!row) return row;
  if (row.estado !== 'oculto') {
    return 'adjuntos' in row ? { ...row, adjuntos: redactAttachments(row.adjuntos) } : row;
  }
  const redacted = { ...row };
  for (const field of HIDDEN_COMMENT_FIELDS) {
    if (field in redacted) redacted[field] = null;
  }
  if ('adjuntos' in redacted) redacted.adjuntos = [];
  // Un comentario oculto no muestra vista previa de sus respuestas.
  if ('respuestas_preview' in redacted) redacted.respuestas_preview = [];
  return redacted;
};

export const redactComments = (rows) => rows.map(redactComment);

// Para listados del propio autor: conserva su texto, pero no las imágenes en revisión.
export const redactOwnComments = (rows) =>
  rows.map((row) =>
    'adjuntos' in row ? { ...row, adjuntos: redactAttachments(row.adjuntos) } : row
  );
