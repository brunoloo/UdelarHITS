-- =========================================================
-- Schema v4 - Foro (PostgreSQL)
-- Cambios v2 (Fase 4.A — moderación):
--   * enum motivo_inactivacion
--   * tema/comentario/categoria: motivo_inactivacion, fecha_inactivacion, inactivado_directo
--   * índices parciales de moderación
-- Cambios v3 (Fase 4.B — apelaciones):
--   * índice único parcial uq_apelacion_pendiente (una apelación pendiente por contenido)
-- Cambios v4 (Fase 4 — frontend de moderación):
--   * motivo_reporte expandido: +acoso, +contenidoInapropiado, +informacionEnganosa, +suplantacion
--   * tabla notificacion (base para notificaciones de moderación y futuras)
-- =========================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

-- -----------------------------
-- ENUMS
-- -----------------------------
CREATE TYPE estado_usr AS ENUM ('activo','inactivo' ,'ban');
CREATE TYPE estado_cat AS ENUM ('activa', 'inactiva');
CREATE TYPE estado_tem AS ENUM ('activo', 'inactivo');
CREATE TYPE estado_com AS ENUM ('visible', 'oculto');

CREATE TYPE rol_participacion AS ENUM ('moderador', 'participante');

CREATE TYPE tipo_reaccion AS ENUM ('meGusta', 'noMeGusta', 'interesante', 'divertido');
CREATE TYPE motivo_reporte AS ENUM ('spam', 'incitacionOdio', 'acoso', 'contenidoInapropiado', 'informacionEnganosa', 'suplantacion');
CREATE TYPE estado_apelacion AS ENUM ('pendiente', 'aceptada', 'rechazada');

-- Por qué un contenido quedó inactivo/oculto. Nunca se infiere por ausencia:
-- cada inactivación escribe su motivo explícito.
--   'autor'              → lo borró su propio autor (Fase 2)
--   'moderacion_reporte' → cayó por cruzar el umbral de reportes (Fase 4.A)
--   'moderacion_admin'   → lo eliminó un admin como moderación (Fase 4.C, previsto)
CREATE TYPE motivo_inactivacion AS ENUM ('autor', 'moderacion_reporte', 'moderacion_admin');

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
  url_banner        TEXT,
  estado            estado_usr   NOT NULL DEFAULT 'activo',
  privado BOOLEAN NOT NULL DEFAULT FALSE,
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
  -- Fase 4.A: previsto para reporte de categorías (aún no usado en 4.A)
  motivo_inactivacion         motivo_inactivacion NULL,
  fecha_inactivacion          TIMESTAMPTZ NULL,
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
  -- Fase 4.A: trazabilidad de inactivación
  motivo_inactivacion  motivo_inactivacion NULL,
  fecha_inactivacion   TIMESTAMPTZ NULL,
  inactivado_directo   BOOLEAN NOT NULL DEFAULT FALSE,
  CHECK (char_length(titulo) > 0),
  UNIQUE (categoria_id, titulo) -- título de tema único dentro de categoría
);

-- historial de edición de tema
CREATE TABLE historial_edicion_tema (
  id                 BIGSERIAL PRIMARY KEY,
  tema_id            BIGINT NOT NULL REFERENCES tema(contenido_id) ON DELETE CASCADE,
  contenido_anterior TEXT NOT NULL,
  contenido_nuevo    TEXT NOT NULL,
  editor_id          BIGINT NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  fecha_edicion      TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
  -- Fase 4.A: trazabilidad de inactivación
  --   inactivado_directo = TRUE  → cruzó su PROPIO umbral de reportes (apelable en 4.B)
  --   inactivado_directo = FALSE → cayó por arrastre (su tema fue reportado)
  motivo_inactivacion     motivo_inactivacion NULL,
  fecha_inactivacion      TIMESTAMPTZ NULL,
  inactivado_directo      BOOLEAN NOT NULL DEFAULT FALSE,
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
  contenido_id      BIGINT NULL REFERENCES contenido(id) ON DELETE CASCADE,
  categoria_id      BIGINT NULL REFERENCES categoria(id) ON DELETE CASCADE,
  motivo            motivo_reporte NOT NULL,
  fecha_reporte     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT reporte_target_check CHECK (
    (contenido_id IS NOT NULL AND categoria_id IS NULL) OR
    (contenido_id IS NULL AND categoria_id IS NOT NULL)
  )
);

-- -----------------------------
-- APELACIONES
-- -----------------------------
CREATE TABLE apelacion (
  id                 BIGSERIAL PRIMARY KEY,
  contenido_id       BIGINT NULL REFERENCES contenido(id) ON DELETE CASCADE,
  categoria_id       BIGINT NULL REFERENCES categoria(id) ON DELETE CASCADE,
  autor_id           BIGINT NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  titulo             VARCHAR(200) NOT NULL,
  justificacion      TEXT NOT NULL,
  estado             estado_apelacion NOT NULL DEFAULT 'pendiente',
  fecha_solicitud    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_resolucion   TIMESTAMPTZ NULL,
  CONSTRAINT apelacion_target_check CHECK (
    (contenido_id IS NOT NULL AND categoria_id IS NULL) OR
    (contenido_id IS NULL AND categoria_id IS NOT NULL)
  )
);

CREATE INDEX idx_apelacion_contenido ON apelacion(contenido_id);
CREATE INDEX idx_apelacion_estado ON apelacion(estado);

-- Una sola apelación pendiente por target (contenido o categoría)
CREATE UNIQUE INDEX uq_apelacion_pendiente_contenido
  ON apelacion (contenido_id)
  WHERE contenido_id IS NOT NULL AND estado = 'pendiente';

CREATE UNIQUE INDEX uq_apelacion_pendiente_categoria
  ON apelacion (categoria_id)
  WHERE categoria_id IS NOT NULL AND estado = 'pendiente';

-- -----------------------------
-- NOTIFICACIONES
-- -----------------------------
-- Registra eventos dirigidos a un usuario (ej: "tu contenido fue moderado").
-- contenido_id nullable con SET NULL: si el contenido se hard-deletea, la
-- notificación sigue existiendo pero sin referencia.
CREATE TABLE notificacion (
  id                BIGSERIAL PRIMARY KEY,
  usuario_id        BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  tipo              VARCHAR(50) NOT NULL,
  mensaje           TEXT NOT NULL,
  contenido_id      BIGINT NULL REFERENCES contenido(id) ON DELETE SET NULL,
  leida             BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_creacion    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------
-- RESEND
-- -----------------------------
CREATE TABLE token_reset_password (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  expira_en TIMESTAMPTZ NOT NULL,
  usado BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------
-- REPORTAR
-- -----------------------------
CREATE TABLE reporte_usuario (
  id SERIAL PRIMARY KEY,
  usuario_reportado_id INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  reportador_id INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  motivo TEXT NOT NULL,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  decision VARCHAR(20),
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_resolucion TIMESTAMPTZ,
  UNIQUE(usuario_reportado_id, reportador_id)
);

-- -----------------------------
-- ÍNDICES ÚTILES
-- -----------------------------
CREATE INDEX idx_contenido_autor ON contenido(autor_id);
CREATE INDEX idx_tema_categoria ON tema(categoria_id);
CREATE INDEX idx_tema_estado ON tema(estado);
CREATE INDEX idx_categoria_estado ON categoria(estado);
CREATE INDEX idx_reporte_contenido ON reporte(contenido_id);
CREATE INDEX idx_reporte_categoria ON reporte(categoria_id) WHERE categoria_id IS NOT NULL;
CREATE UNIQUE INDEX uq_reporte_usuario_contenido ON reporte(usuario_id, contenido_id) WHERE contenido_id IS NOT NULL;
CREATE UNIQUE INDEX uq_reporte_usuario_categoria ON reporte(usuario_id, categoria_id) WHERE categoria_id IS NOT NULL;
CREATE INDEX idx_reaccion_contenido ON reaccion(contenido_id);

-- Fase 4.A: índices parciales para listar contenido caído por moderación
CREATE INDEX idx_tema_moderacion
  ON tema (motivo_inactivacion)
  WHERE motivo_inactivacion = 'moderacion_reporte';

CREATE INDEX idx_comentario_moderacion
  ON comentario (motivo_inactivacion)
  WHERE motivo_inactivacion = 'moderacion_reporte';

-- Notificaciones
CREATE INDEX idx_notificacion_usuario ON notificacion(usuario_id, fecha_creacion DESC);
CREATE INDEX idx_notificacion_no_leida ON notificacion(usuario_id) WHERE leida = FALSE;