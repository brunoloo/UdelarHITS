// Lista fija de facultades. `sigla` es el nombre de la etiqueta (grupo 'Facultades') con el
// que se filtra el feed; un test de backend verifica que cada una exista en la base
// (tests/category/facultades-config.test.js).

export const FACULTADES = [
  { sigla: 'FADU',   nombre: 'Arquitectura, Diseño y Urbanismo',        color: '#7F77DD' },
  { sigla: 'FAGRO',  nombre: 'Agronomía',                               color: '#639922' },
  { sigla: 'Fartes', nombre: 'Artes',                                   color: '#D4537E' },
  { sigla: 'FCEA',   nombre: 'Ciencias Económicas y de Administración', color: '#BA7517' },
  { sigla: 'FCIEN',  nombre: 'Ciencias',                                color: '#1D9E75' },
  { sigla: 'FCS',    nombre: 'Ciencias Sociales',                       color: '#D85A30' },
  { sigla: 'FDER',   nombre: 'Derecho',                                 color: '#378ADD' },
  { sigla: 'FENF',   nombre: 'Enfermería',                              color: '#E24B4A' },
  { sigla: 'FHCE',   nombre: 'Humanidades y Ciencias de la Educación',  color: '#888780' },
  { sigla: 'FIC',    nombre: 'Información y Comunicación',              color: '#EF9F27' },
  { sigla: 'FING',   nombre: 'Ingeniería',                              color: '#185FA5' },
  { sigla: 'FMED',   nombre: 'Medicina',                                color: '#F09595' },
  { sigla: 'FOdont', nombre: 'Odontología',                             color: '#5DCAA5' },
  { sigla: 'FPsico', nombre: 'Psicología',                              color: '#AFA9EC' },
  { sigla: 'FQ',     nombre: 'Química',                                 color: '#97C459' },
  { sigla: 'FVET',   nombre: 'Veterinaria',                             color: '#85B7EB' },
]

// Tolera tildes y mayúsculas. Devuelve null si la etiqueta no es una facultad.
export function facultadBySigla(sigla) {
  if (!sigla) return null
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const target = norm(sigla)
  return FACULTADES.find(f => norm(f.sigla) === target) ?? null
}
