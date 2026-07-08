-- Migración: ENUM etiqueta → tabla etiqueta
-- Convierte el sistema de etiquetas de un tipo ENUM fijo a una tabla relacional
-- para poder agregar/quitar etiquetas con un simple INSERT/DELETE.
--
-- Pasos:
--   1. Crear tabla etiqueta con seed data
--   2. Crear tabla categoria_etiqueta_new con FK a etiqueta(id)
--   3. Migrar datos existentes de categoria_etiqueta → categoria_etiqueta_new
--   4. Renombrar tablas (old → _legacy, new → principal)
--   5. Eliminar tipo ENUM etiqueta

BEGIN;

-- 1. Crear tabla etiqueta
CREATE TABLE IF NOT EXISTS etiqueta (
  id             BIGSERIAL PRIMARY KEY,
  nombre         VARCHAR(100) NOT NULL UNIQUE,
  nombre_display VARCHAR(150),
  grupo          VARCHAR(50) NOT NULL,
  orden          SMALLINT NOT NULL DEFAULT 0
);

-- 2. Insertar seed data (ON CONFLICT para idempotencia)
-- Grupo: Facultades
INSERT INTO etiqueta (nombre, nombre_display, grupo, orden) VALUES
  ('FADU', 'Arquitectura, Diseño y Urbanismo', 'Facultades', 1),
  ('FAGRO', 'Agronomía', 'Facultades', 2),
  ('Fartes', 'Artes', 'Facultades', 3),
  ('FCEA', 'Ciencias Económicas y de Administración', 'Facultades', 4),
  ('FCIEN', 'Ciencias', 'Facultades', 5),
  ('FCS', 'Ciencias Sociales', 'Facultades', 6),
  ('FDER', 'Derecho', 'Facultades', 7),
  ('FENF', 'Enfermería', 'Facultades', 8),
  ('FHCE', 'Humanidades y Ciencias de la Educación', 'Facultades', 9),
  ('FIC', 'Información y Comunicación', 'Facultades', 10),
  ('FING', 'Ingeniería', 'Facultades', 11),
  ('FMED', 'Medicina', 'Facultades', 12),
  ('FOdont', 'Odontología', 'Facultades', 13),
  ('FPsico', 'Psicología', 'Facultades', 14),
  ('FQ', 'Química', 'Facultades', 15),
  ('FVET', 'Veterinaria', 'Facultades', 16)
ON CONFLICT (nombre) DO NOTHING;

-- Grupo: Materias FING
INSERT INTO etiqueta (nombre, nombre_display, grupo, orden) VALUES
  ('GAL1', 'Geometría y Álgebra Lineal 1', 'Materias FING', 1),
  ('GAL2', 'Geometría y Álgebra Lineal 2', 'Materias FING', 2),
  ('CDIV', 'Cálculo Diferencial e Integral en una Variable', 'Materias FING', 3),
  ('CDIVV', 'Cálculo Diferencial e Integral en Varias Variables', 'Materias FING', 4),
  ('EcDif', 'Introducción a las Ecuaciones Diferenciales', 'Materias FING', 5),
  ('MetNum', 'Métodos Numéricos', 'Materias FING', 6),
  ('MD1', 'Matemática Discreta 1', 'Materias FING', 7),
  ('MD2', 'Matemática Discreta 2', 'Materias FING', 8),
  ('Física 1', NULL, 'Materias FING', 9),
  ('Física 2', NULL, 'Materias FING', 10),
  ('P1', 'Programación 1', 'Materias FING', 11),
  ('P2', 'Programación 2', 'Materias FING', 12),
  ('P3', 'Programación 3', 'Materias FING', 13),
  ('P4', 'Programación 4', 'Materias FING', 14),
  ('FBD', 'Fundamentos de Bases de Datos', 'Materias FING', 15),
  ('Lógica', NULL, 'Materias FING', 16),
  ('Estadística', 'Estadística I', 'Materias FING', 17),
  ('CM', 'Complemento de Matemática', 'Materias FING', 18),
  ('TIC', 'Taller de Introducción a la Computación', 'Materias FING', 19)
ON CONFLICT (nombre) DO NOTHING;

-- Grupo: Áreas académicas
INSERT INTO etiqueta (nombre, nombre_display, grupo, orden) VALUES
  ('Matemática', NULL, 'Áreas académicas', 1),
  ('Física', NULL, 'Áreas académicas', 2),
  ('Química', NULL, 'Áreas académicas', 3),
  ('Biología', NULL, 'Áreas académicas', 4),
  ('Programación', NULL, 'Áreas académicas', 5),
  ('Economía', NULL, 'Áreas académicas', 6),
  ('Derecho (área)', NULL, 'Áreas académicas', 7),
  ('Medicina (área)', NULL, 'Áreas académicas', 8),
  ('Psicología (área)', NULL, 'Áreas académicas', 9),
  ('Filosofía', NULL, 'Áreas académicas', 10),
  ('Historia', NULL, 'Áreas académicas', 11),
  ('Sociología', NULL, 'Áreas académicas', 12),
  ('Ingeniería (área)', NULL, 'Áreas académicas', 13),
  ('Arquitectura', NULL, 'Áreas académicas', 14),
  ('Diseño', NULL, 'Áreas académicas', 15),
  ('Comunicación', NULL, 'Áreas académicas', 16),
  ('Educación', NULL, 'Áreas académicas', 17),
  ('Ciencia', NULL, 'Áreas académicas', 18)
ON CONFLICT (nombre) DO NOTHING;

-- Grupo: Vida universitaria
INSERT INTO etiqueta (nombre, nombre_display, grupo, orden) VALUES
  ('Parciales y exámenes', NULL, 'Vida universitaria', 1),
  ('Becas y trámites', NULL, 'Vida universitaria', 2),
  ('Pasantías', NULL, 'Vida universitaria', 3),
  ('Trabajo y carrera', NULL, 'Vida universitaria', 4),
  ('Residencias', NULL, 'Vida universitaria', 5),
  ('Tutoriales', NULL, 'Vida universitaria', 6),
  ('Preguntas', NULL, 'Vida universitaria', 7),
  ('Feedback', NULL, 'Vida universitaria', 8)
ON CONFLICT (nombre) DO NOTHING;

-- Grupo: Intereses
INSERT INTO etiqueta (nombre, nombre_display, grupo, orden) VALUES
  ('Gaming', NULL, 'Intereses', 1),
  ('Memes', NULL, 'Intereses', 2),
  ('Deportes', NULL, 'Intereses', 3),
  ('Música', NULL, 'Intereses', 4),
  ('Cine y TV', NULL, 'Intereses', 5),
  ('Arte', NULL, 'Intereses', 6),
  ('Cocina', NULL, 'Intereses', 7),
  ('Salud y fitness', NULL, 'Intereses', 8),
  ('Mascotas', NULL, 'Intereses', 9),
  ('Hobbies', NULL, 'Intereses', 10),
  ('Viajes', NULL, 'Intereses', 11),
  ('Naturaleza', NULL, 'Intereses', 12),
  ('Fotografía', NULL, 'Intereses', 13),
  ('Escritura', NULL, 'Intereses', 14),
  ('Moda', NULL, 'Intereses', 15),
  ('Autos y motos', NULL, 'Intereses', 16),
  ('Jardinería', NULL, 'Intereses', 17),
  ('Vida diaria', NULL, 'Intereses', 18),
  ('Relaciones', NULL, 'Intereses', 19),
  ('Noticias', NULL, 'Intereses', 20),
  ('Eventos', NULL, 'Intereses', 21),
  ('Tecnología', NULL, 'Intereses', 22),
  ('Otro', NULL, 'Intereses', 23)
ON CONFLICT (nombre) DO NOTHING;

-- Etiquetas del ENUM viejo que no tienen equivalente exacto en el seed nuevo.
-- Se agregan para no perder las asignaciones de categorías existentes.
INSERT INTO etiqueta (nombre, nombre_display, grupo, orden) VALUES
  ('Facultades', NULL, 'Vida universitaria', 0),
  ('Política', NULL, 'Áreas académicas', 19),
  ('Desarrollo web', NULL, 'Intereses', 24),
  ('Software', NULL, 'Intereses', 25),
  ('Ciberseguridad', NULL, 'Intereses', 26),
  ('Inteligencia artificial', NULL, 'Intereses', 27),
  ('Gadgets', NULL, 'Intereses', 28),
  ('Animación', NULL, 'Intereses', 29),
  ('Manualidades', NULL, 'Intereses', 30),
  ('Hogar', NULL, 'Intereses', 31),
  ('Cultura', NULL, 'Intereses', 32),
  ('Medio ambiente', NULL, 'Intereses', 33),
  ('Historias', NULL, 'Intereses', 34),
  ('Reseñas', NULL, 'Intereses', 35)
ON CONFLICT (nombre) DO NOTHING;

-- Mapeo para etiquetas del ENUM cuyo nombre cambió en la nueva tabla.
-- Ingeniería → Ingeniería (área), Derecho → Derecho (área), etc.
-- Creamos una tabla temporal para el mapeo.
CREATE TEMP TABLE _etiqueta_map (old_name TEXT, new_name TEXT);
INSERT INTO _etiqueta_map VALUES
  ('Ingeniería', 'Ingeniería (área)'),
  ('Derecho',    'Derecho (área)'),
  ('Medicina',   'Medicina (área)'),
  ('Psicología', 'Psicología (área)');

-- 3. Crear tabla nueva
CREATE TABLE categoria_etiqueta_new (
  categoria_id BIGINT NOT NULL REFERENCES categoria(id) ON DELETE CASCADE,
  etiqueta_id  BIGINT NOT NULL REFERENCES etiqueta(id) ON DELETE CASCADE,
  PRIMARY KEY (categoria_id, etiqueta_id)
);

-- 4. Migrar datos existentes
-- Para tags con nombre renombrado (ej: Ingeniería → Ingeniería (área)):
INSERT INTO categoria_etiqueta_new (categoria_id, etiqueta_id)
SELECT ce.categoria_id, e.id
FROM categoria_etiqueta ce
JOIN _etiqueta_map m ON ce.etiqueta_valor::text = m.old_name
JOIN etiqueta e ON e.nombre = m.new_name
ON CONFLICT DO NOTHING;

-- Para tags cuyo nombre se mantuvo igual:
INSERT INTO categoria_etiqueta_new (categoria_id, etiqueta_id)
SELECT ce.categoria_id, e.id
FROM categoria_etiqueta ce
JOIN etiqueta e ON e.nombre = ce.etiqueta_valor::text
WHERE ce.etiqueta_valor::text NOT IN (SELECT old_name FROM _etiqueta_map)
ON CONFLICT DO NOTHING;

DROP TABLE _etiqueta_map;

-- 5. Renombrar tablas
ALTER TABLE categoria_etiqueta RENAME TO categoria_etiqueta_legacy;
ALTER TABLE categoria_etiqueta_new RENAME TO categoria_etiqueta;

-- 6. Eliminar el tipo ENUM (ya no lo usa nadie)
DROP TYPE etiqueta;

COMMIT;
