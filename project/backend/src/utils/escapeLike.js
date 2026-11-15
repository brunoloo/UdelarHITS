// Escapa `%`, `_` y la barra invertida para que el término se compare como texto
// literal en LIKE/ILIKE. El resultado se pasa siempre como parámetro.
export function escapeLike(value) {
  if (value == null) return '';
  return String(value).replace(/[\\%_]/g, '\\$&');
}
