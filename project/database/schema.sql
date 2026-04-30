-- =========================================================
-- Schema v1 - Foro (PostgreSQL)
-- =========================================================

-- -----------------------------
-- ENUMS
-- -----------------------------
CREATE TYPE estado_usr AS ENUM ('activo', 'ban');
CREATE TYPE estado_cat AS ENUM ('activa', 'inactiva');
CREATE TYPE estado_tem AS ENUM ('activo', 'inactivo');
CREATE TYPE estado_com AS ENUM ('visible', 'oculto');

CREATE TYPE rol_participacion AS ENUM ('moderador', 'participante');

CREATE TYPE tipo_reaccion AS ENUM ('meGusta', 'noMeGusta', 'interesante', 'divertido');
CREATE TYPE motivo_reporte AS ENUM ('spam', 'incitacionOdio');
CREATE TYPE estado_apelacion AS ENUM ('pendiente', 'aceptada', 'rechazada');

CREATE TYPE etiqueta AS ENUM (
  -- Vida universitaria
  'Facultades', 'Parciales y exámenes', 'Becas y trámites', 'Residencias', 'Pasantías',
  
  -- Académico
  'Educación', 'Ciencia', 'Matemática', 'Ingeniería', 'Filosofía',
  'Historia', 'Psicología', 'Economía', 'Política', 'Derecho', 'Medicina',
  
  -- Tecnología
  'Programación', 'Desarrollo web', 'Software', 'Ciberseguridad',
  'Inteligencia artificial', 'Gadgets', 'Gaming',
  
  -- Creatividad
  'Arte', 'Diseño', 'Fotografía', 'Cine y TV', 'Música',
  'Escritura', 'Animación', 'Manualidades', 'Moda',
  
  -- Vida cotidiana
  'Vida diaria', 'Relaciones', 'Cocina', 'Salud y fitness',
  'Trabajo y carrera', 'Hogar', 'Mascotas', 'Hobbies',
  
  -- Sociedad
  'Cultura', 'Viajes', 'Deportes', 'Naturaleza',
  'Medio ambiente', 'Noticias', 'Eventos',
  
  -- Comunidad
  'Memes', 'Tutoriales', 'Preguntas', 'Historias',
  'Reseñas', 'Feedback', 'Autos y motos', 'Jardinería', 'Otro'
);

-- -----------------------------
-- USUARIO
-- -----------------------------
CREATE TABLE usuario ( -- Revisado y completo. No modificar
  id                BIGSERIAL PRIMARY KEY,
  rol               VARCHAR(20) NOT NULL DEFAULT 'user',

  nickname          VARCHAR(50)  NOT NULL UNIQUE,
  nombre            VARCHAR(120) NOT NULL,
  email             VARCHAR(255) NOT NULL UNIQUE,
  password_hash     TEXT         NOT NULL,
  biografia         TEXT,
  url_imagen        TEXT,
  estado            estado_usr   NOT NULL DEFAULT 'activo',
  fecha_creacion    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Relación usuario sigue usuario (N:N)
CREATE TABLE usuario_seguidor ( -- Revisar
  seguidor_id       BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  seguido_id        BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  fecha_creacion    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (seguidor_id, seguido_id),
  CHECK (seguidor_id <> seguido_id)
);

-- -----------------------------
-- CATEGORIA
-- -----------------------------
CREATE TABLE categoria ( -- Revisado y completo. No modificar
  id                          BIGSERIAL PRIMARY KEY,
  titulo                      VARCHAR(150) NOT NULL UNIQUE,
  descripcion                 TEXT NOT NULL,
  autor_id                    BIGINT NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  contador_temas              INTEGER NOT NULL DEFAULT 0 CHECK (contador_temas >= 0),
  estado                      estado_cat NOT NULL DEFAULT 'activa',
  fecha_creacion              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- categoria puede tener 1..N etiquetas
CREATE TABLE categoria_etiqueta (
  categoria_id        BIGINT NOT NULL REFERENCES categoria(id) ON DELETE CASCADE,
  etiqueta_valor      etiqueta NOT NULL,
  PRIMARY KEY (categoria_id, etiqueta_valor)
);

-- historial de edición de descripción de categoría
CREATE TABLE historial_edicion_categoria (
  id                  BIGSERIAL PRIMARY KEY,
  categoria_id        BIGINT NOT NULL REFERENCES categoria(id) ON DELETE CASCADE,
  descripcion_anterior TEXT NOT NULL,
  descripcion_nueva    TEXT NOT NULL,
  editor_id            BIGINT NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  fecha_edicion        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- participación usuario-categoría (un único rol por categoría)
CREATE TABLE participacion_categoria (
  usuario_id         BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  categoria_id       BIGINT NOT NULL REFERENCES categoria(id) ON DELETE CASCADE,
  rol                rol_participacion NOT NULL,
  fecha_asignacion   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, categoria_id)
);

-- -----------------------------
-- CONTENIDO (supertipo)
-- -----------------------------
CREATE TABLE contenido (
  id                BIGSERIAL PRIMARY KEY,
  autor_id          BIGINT NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  cuerpo            TEXT NOT NULL,
  fecha_creacion    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------
-- TEMA (subtipo de contenido)
-- -----------------------------
CREATE TABLE tema ( 
  contenido_id      BIGINT PRIMARY KEY REFERENCES contenido(id) ON DELETE CASCADE,
  categoria_id      BIGINT NOT NULL REFERENCES categoria(id) ON DELETE RESTRICT,
  titulo            VARCHAR(200) NOT NULL,
  estado            estado_tem NOT NULL DEFAULT 'activo',
  CHECK (char_length(titulo) > 0),
  UNIQUE (categoria_id, titulo) -- título de tema único dentro de categoría
);

-- -----------------------------
-- COMENTARIO (subtipo de contenido)
-- -----------------------------
CREATE TABLE comentario (
  contenido_id            BIGINT PRIMARY KEY REFERENCES contenido(id) ON DELETE CASCADE,
  tema_id                 BIGINT NULL REFERENCES tema(contenido_id) ON DELETE CASCADE,
  categoria_id            BIGINT NULL REFERENCES categoria(id) ON DELETE CASCADE,
  comentario_padre_id     BIGINT NULL REFERENCES comentario(contenido_id) ON DELETE CASCADE,
  estado                  estado_com NOT NULL DEFAULT 'visible',
  CONSTRAINT comentario_target_check CHECK (
    (tema_id IS NOT NULL AND categoria_id IS NULL) OR
    (tema_id IS NULL AND categoria_id IS NOT NULL)
  )
);

-- Índices para jerarquía de comentarios
CREATE INDEX idx_comentario_tema_id ON comentario(tema_id);
CREATE INDEX idx_comentario_padre_id ON comentario(comentario_padre_id);

-- historial de edición de comentario
CREATE TABLE historial_edicion_comentario (
  id                   BIGSERIAL PRIMARY KEY,
  comentario_id        BIGINT NOT NULL REFERENCES comentario(contenido_id) ON DELETE CASCADE,
  contenido_anterior   TEXT NOT NULL,
  contenido_nuevo      TEXT NOT NULL,
  editor_id            BIGINT NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  fecha_edicion        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------
-- REACCIONES
-- -----------------------------
CREATE TABLE reaccion (
  id                BIGSERIAL PRIMARY KEY,
  usuario_id        BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  contenido_id      BIGINT NOT NULL REFERENCES contenido(id) ON DELETE CASCADE,
  tipo              tipo_reaccion NOT NULL,
  fecha_creacion    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, contenido_id) -- max 1 reacción por usuario por contenido
);

-- -----------------------------
-- REPORTES
-- -----------------------------
CREATE TABLE reporte (
  id                BIGSERIAL PRIMARY KEY,
  usuario_id        BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  contenido_id      BIGINT NOT NULL REFERENCES contenido(id) ON DELETE CASCADE,
  motivo            motivo_reporte NOT NULL,
  fecha_reporte     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, contenido_id) -- no reportar dos veces mismo contenido
);

-- -----------------------------
-- APELACIONES
-- -----------------------------
CREATE TABLE apelacion (
  id                 BIGSERIAL PRIMARY KEY,
  contenido_id       BIGINT NOT NULL REFERENCES contenido(id) ON DELETE CASCADE,
  autor_id           BIGINT NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  titulo             VARCHAR(200) NOT NULL,
  justificacion      TEXT NOT NULL,
  estado             estado_apelacion NOT NULL DEFAULT 'pendiente',
  fecha_solicitud    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_resolucion   TIMESTAMPTZ NULL
);

CREATE INDEX idx_apelacion_contenido ON apelacion(contenido_id);
CREATE INDEX idx_apelacion_estado ON apelacion(estado);

-- -----------------------------
-- ÍNDICES ÚTILES
-- -----------------------------
CREATE INDEX idx_contenido_autor ON contenido(autor_id);
CREATE INDEX idx_tema_categoria ON tema(categoria_id);
CREATE INDEX idx_tema_estado ON tema(estado);
CREATE INDEX idx_categoria_estado ON categoria(estado);
CREATE INDEX idx_reporte_contenido ON reporte(contenido_id);
CREATE INDEX idx_reaccion_contenido ON reaccion(contenido_id);