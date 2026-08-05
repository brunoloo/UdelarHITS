// Lista fija de las 16 facultades de la Udelar. Es config del front (mismo
// patrón que backend/src/config/categoryIcons.js): sigla, nombre completo y
// color de acento de cada una. Los únicos hex nuevos del proyecto viven acá —
// no dispersos en el CSS.
//
// La `sigla` es el `etiqueta.nombre` (grupo 'Facultades') con el que se filtra
// el feed: <Link to="/?etiqueta=SIGLA">. El casing es el de la base (mezcla
// intencional: 'Fartes', 'FOdont', 'FPsico'); en la UI se muestra en
// mayúsculas vía CSS. Si alguien renombra una etiqueta en la base, la ficha
// quedaría vacía en silencio: por eso hay un test de backend
// (tests/category/facultades-config.test.js) que verifica que cada sigla exista
// en `etiqueta` con grupo = 'Facultades'. Es el único acoplamiento aceptable
// entre esta lista y la base — mantener ambos en sync.
//
// El orden es fijo (el mismo del seed en schema.sql) y no se reordena en runtime.

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

// Busca una facultad por sigla, tolerante a tildes y casing (la URL puede
// traer ?etiqueta=fing o ?etiqueta=FING). Devuelve null si la etiqueta no es
// una facultad (ej. un click a una etiqueta cualquiera del dropdown), para que
// la píldora sepa caer al color/label de acento genérico.
export function facultadBySigla(sigla) {
  if (!sigla) return null
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  const target = norm(sigla)
  return FACULTADES.find(f => norm(f.sigla) === target) ?? null
}
