// Textos-resumen de los paneles cerrados de crear y editar categoría.

export function descriptionSummary(descripcion) {
  const clean = (descripcion || '').trim().replace(/\s+/g, ' ')
  if (!clean) return 'Descripción'
  return clean.length > 50 ? clean.slice(0, 50) + '…' : clean
}

export function tagsSummary(selectedTags) {
  const n = selectedTags?.length || 0
  if (n === 0) return 'Seleccionar etiquetas'
  return `${n} etiqueta${n === 1 ? '' : 's'} seleccionada${n === 1 ? '' : 's'}`
}
