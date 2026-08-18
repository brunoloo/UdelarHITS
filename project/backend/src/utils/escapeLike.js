// ── Escape de comodines de LIKE/ILIKE ────────────────────────────────────────
// En un patrón LIKE/ILIKE, `%` (cualquier secuencia) y `_` (un carácter) son
// comodines, y `\` es el carácter de escape por defecto. Si el término del
// usuario los lleva sin escapar, buscar "100%" trae TODO y "a_b" matchea "aXb".
//
// Devuelve el término con esos tres caracteres escapados con `\`. El call site
// DEBE usar la cláusula `ESCAPE '\'` explícita (o el default de Postgres, que ya
// es `\`) y pasar el resultado como parámetro `$n` — nunca concatenarlo al SQL.
//
// Ejemplo: `col ILIKE '%' || $1 || '%' ESCAPE '\'` con params [escapeLike(term)].
export function escapeLike(value) {
  if (value == null) return '';
  return String(value).replace(/[\\%_]/g, '\\$&');
}
