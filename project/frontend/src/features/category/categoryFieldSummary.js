// Textos-resumen que muestran los paneles acordeón cerrados de crear/editar
// categoría. Compartidos para que ambos se vean igual.

// Descripción: preview truncado (~50 chars, en una sola línea) o placeholder.
export function descriptionSummary(descripcion) {
  const clean = (descripcion || '').trim().replace(/\s+/g, ' ')
  if (!clean) return 'Descripción'
  return clean.length > 50 ? clean.slice(0, 50) + '…' : clean
}

// Etiquetas: cuántas hay seleccionadas, o placeholder.
export function tagsSummary(selectedTags) {
  const n = selectedTags?.length || 0
  if (n === 0) return 'Seleccionar etiquetas'
  return `${n} etiqueta${n === 1 ? '' : 's'} seleccionada${n === 1 ? '' : 's'}`
}
