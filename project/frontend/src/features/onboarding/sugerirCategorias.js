import { facultadBySigla } from '../../config/facultades'
import { parseEtiquetas } from '../../utils/parseEtiquetas'

const actividad = (c) => (Number(c.contador_temas) || 0) + (Number(c.contador_comentarios) || 0)

// Categorías para ofrecer a una cuenta nueva: primero las de su facultad, después las
// que tienen más contenido; a igualdad, las más nuevas.
export function sugerirCategorias(categorias, facultad, limite = 8) {
  const sigla = facultadBySigla(facultad)?.sigla ?? null
  const esDeMiFacultad = (c) =>
    sigla != null && parseEtiquetas(c.etiquetas).some(t => facultadBySigla(t)?.sigla === sigla)

  return [...categorias]
    .map(c => ({ c, propia: esDeMiFacultad(c) }))
    .sort((a, b) =>
      (b.propia - a.propia)
      || (actividad(b.c) - actividad(a.c))
      || (new Date(b.c.fecha_creacion) - new Date(a.c.fecha_creacion)))
    .slice(0, limite)
    .map(({ c, propia }) => ({ ...c, deMiFacultad: propia }))
}
