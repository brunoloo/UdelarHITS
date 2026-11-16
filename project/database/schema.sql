-- Esquema de UdelarHITS (PostgreSQL). Requiere la extensión unaccent.

CREATE EXTENSION IF NOT EXISTS unaccent;

-- Enums
CREATE TYPE estado_usr AS ENUM ('activo','inactivo' ,'ban');
CREATE TYPE estado_cat AS ENUM ('activa', 'inactiva');
CREATE TYPE estado_tem AS ENUM ('activo', 'inactivo');
CREATE TYPE estado_com AS ENUM ('visible', 'oculto');

CREATE TYPE rol_participacion AS ENUM ('moderador', 'participante');

CREATE TYPE tipo_reaccion AS ENUM ('meGusta', 'noMeGusta', 'interesante', 'divertido');
CREATE TYPE motivo_reporte AS ENUM ('spam', 'incitacionOdio', 'acoso', 'contenidoInapropiado', 'informacionEnganosa', 'suplantacion');
CREATE TYPE estado_apelacion AS ENUM ('pendiente', 'aceptada', 'rechazada');

-- Motivo por el que un contenido quedó inactivo u oculto; cada inactivación lo registra.
-- 'autor' = borrado por su autor · 'moderacion_reporte' = umbral de reportes · 'moderacion_admin' = eliminado por un admin
CREATE TYPE motivo_inactivacion AS ENUM ('autor', 'moderacion_reporte', 'moderacion_admin');

-- Etiquetas en tabla: agregar una es un INSERT.
CREATE TABLE etiqueta (
  id             BIGSERIAL PRIMARY KEY,
  nombre         VARCHAR(100) NOT NULL UNIQUE,
  nombre_display VARCHAR(150),
  grupo          VARCHAR(50) NOT NULL,
  orden          SMALLINT NOT NULL DEFAULT 0
);

INSERT INTO etiqueta (nombre, nombre_display, grupo, orden) VALUES
  -- Facultades
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
  ('FVET', 'Veterinaria', 'Facultades', 16),
  -- Materias FING
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
  ('TIC', 'Taller de Introducción a la Computación', 'Materias FING', 19),
  -- Áreas académicas
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
  ('Ciencia', NULL, 'Áreas académicas', 18),
  -- Vida universitaria
  ('Parciales y exámenes', NULL, 'Vida universitaria', 1),
  ('Becas y trámites', NULL, 'Vida universitaria', 2),
  ('Pasantías', NULL, 'Vida universitaria', 3),
  ('Trabajo y carrera', NULL, 'Vida universitaria', 4),
  ('Residencias', NULL, 'Vida universitaria', 5),
  ('Tutoriales', NULL, 'Vida universitaria', 6),
  ('Preguntas', NULL, 'Vida universitaria', 7),
  ('Feedback', NULL, 'Vida universitaria', 8),
  -- Intereses
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
  ('Otro', NULL, 'Intereses', 23);

-- Usuario
CREATE TABLE usuario (
  id                BIGSERIAL PRIMARY KEY,
  rol               VARCHAR(20) NOT NULL DEFAULT 'user',
  nickname          VARCHAR(50)  NOT NULL UNIQUE,
  nombre            VARCHAR(120) NOT NULL,
  email             VARCHAR(255) NOT NULL UNIQUE,
  password_hash     TEXT,
  auth_provider     VARCHAR(10)  NOT NULL DEFAULT 'local',
  biografia         TEXT,
  -- Abreviatura del catálogo `etiqueta` (grupo 'Facultades'); NULL = sin especificar.
  -- Sin FK a propósito: viaja junto al autor en muchas consultas y una FK obligaría a un JOIN en todas.
  facultad          VARCHAR(20),
  url_imagen        TEXT,
  url_banner        TEXT,
  estado            estado_usr   NOT NULL DEFAULT 'activo',
  nickname_confirmado BOOLEAN NOT NULL DEFAULT TRUE,
  privado BOOLEAN NOT NULL DEFAULT FALSE,
  me_gusta_privado BOOLEAN NOT NULL DEFAULT FALSE,
  -- TRUE por defecto: sin suscripción no se envía nada y la barrera real es el permiso del navegador.
  push_activado BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- NULL = sin accesos registrados desde que existe la columna.
  fecha_ultimo_acceso TIMESTAMPTZ
);

-- Seguimiento entre usuarios (N:N)
CREATE TABLE usuario_seguidor (
  seguidor_id       BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  seguido_id        BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  -- 'aceptado' = sigue efectivamente; 'pendiente' = solicitud a una cuenta privada.
  estado            VARCHAR(20) NOT NULL DEFAULT 'aceptado' CHECK (estado IN ('pendiente','aceptado')),
  fecha_creacion    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (seguidor_id, seguido_id),
  CHECK (seguidor_id <> seguido_id)
);

-- Categoría
CREATE TABLE categoria (
  id                          BIGSERIAL PRIMARY KEY,
  titulo                      VARCHAR(150) NOT NULL UNIQUE,
  descripcion                 TEXT NOT NULL,
  autor_id                    BIGINT NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  contador_temas              INTEGER NOT NULL DEFAULT 0 CHECK (contador_temas >= 0),
  estado                      estado_cat NOT NULL DEFAULT 'activa',
  -- Nombre del ícono. Ver backend/src/config/categoryIcons.js.
  icono                       VARCHAR(50) NOT NULL DEFAULT 'grid',
  -- Fijados por el creador: hasta un tema y un comentario directo. Las FK a contenido se agregan al final.
  tema_fijado_id              BIGINT,
  comentario_fijado_id        BIGINT,
  -- Fijada en el Home hasta esta fecha; NULL = no fijada.
  fijada_hasta                TIMESTAMPTZ NULL,
  motivo_inactivacion         motivo_inactivacion NULL,
  fecha_inactivacion          TIMESTAMPTZ NULL,
  fecha_creacion              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Una categoría tiene una o más etiquetas
CREATE TABLE categoria_etiqueta (
  categoria_id BIGINT NOT NULL REFERENCES categoria(id) ON DELETE CASCADE,
  etiqueta_id  BIGINT NOT NULL REFERENCES etiqueta(id) ON DELETE CASCADE,
  PRIMARY KEY (categoria_id, etiqueta_id)
);

-- Historial de edición de la descripción
CREATE TABLE historial_edicion_categoria (
  id                  BIGSERIAL PRIMARY KEY,
  categoria_id        BIGINT NOT NULL REFERENCES categoria(id) ON DELETE CASCADE,
  descripcion_anterior TEXT NOT NULL,
  descripcion_nueva    TEXT NOT NULL,
  editor_id            BIGINT NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  fecha_edicion        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Participación de un usuario en una categoría (un rol por categoría)
CREATE TABLE participacion_categoria (
  usuario_id         BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  categoria_id       BIGINT NOT NULL REFERENCES categoria(id) ON DELETE CASCADE,
  rol                rol_participacion NOT NULL,
  fecha_asignacion   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, categoria_id)
);

-- Contenido (supertipo de tema y comentario)
CREATE TABLE contenido (
  id                BIGSERIAL PRIMARY KEY,
  autor_id          BIGINT NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  cuerpo            TEXT NOT NULL,
  fecha_creacion    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tema
CREATE TABLE tema ( 
  contenido_id      BIGINT PRIMARY KEY REFERENCES contenido(id) ON DELETE CASCADE,
  categoria_id      BIGINT NOT NULL REFERENCES categoria(id) ON DELETE RESTRICT,
  titulo            VARCHAR(200) NOT NULL,
  estado            estado_tem NOT NULL DEFAULT 'activo',
  motivo_inactivacion  motivo_inactivacion NULL,
  fecha_inactivacion   TIMESTAMPTZ NULL,
  inactivado_directo   BOOLEAN NOT NULL DEFAULT FALSE,
  -- Comentario fijado por el moderador (creador) del tema.
  comentario_fijado_id BIGINT REFERENCES contenido(id) ON DELETE SET NULL,
  CHECK (char_length(titulo) > 0),
  UNIQUE (categoria_id, titulo) -- título de tema único dentro de categoría
);

-- Historial de edición de tema
CREATE TABLE historial_edicion_tema (
  id                 BIGSERIAL PRIMARY KEY,
  tema_id            BIGINT NOT NULL REFERENCES tema(contenido_id) ON DELETE CASCADE,
  contenido_anterior TEXT NOT NULL,
  contenido_nuevo    TEXT NOT NULL,
  editor_id          BIGINT NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  fecha_edicion      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comentario
CREATE TABLE comentario (
  contenido_id            BIGINT PRIMARY KEY REFERENCES contenido(id) ON DELETE CASCADE,
  tema_id                 BIGINT NULL REFERENCES tema(contenido_id) ON DELETE CASCADE,
  categoria_id            BIGINT NULL REFERENCES categoria(id) ON DELETE CASCADE,
  comentario_padre_id     BIGINT NULL REFERENCES comentario(contenido_id) ON DELETE CASCADE,
  estado                  estado_com NOT NULL DEFAULT 'visible',
  -- inactivado_directo = TRUE: cruzó su propio umbral de reportes (apelable);
  -- FALSE: cayó por arrastre de su tema.
  motivo_inactivacion     motivo_inactivacion NULL,
  fecha_inactivacion      TIMESTAMPTZ NULL,
  inactivado_directo      BOOLEAN NOT NULL DEFAULT FALSE,
  -- Comentario de Home, sin categoría ni tema. El ámbito se marca con este flag explícito
  -- para que no puedan crearse comentarios huérfanos.
  es_home                 BOOLEAN NOT NULL DEFAULT FALSE,
  -- Comentario de Home fijado hasta esta fecha; NULL = no fijado.
  fijado_home_hasta       TIMESTAMPTZ NULL,
  -- Tres ámbitos mutuamente excluyentes: exactamente uno presente.
  CONSTRAINT comentario_target_check CHECK (
    (tema_id IS NOT NULL)::int + (categoria_id IS NOT NULL)::int + (es_home)::int = 1
  )
);

-- Índices para jerarquía de comentarios
CREATE INDEX idx_comentario_tema_id ON comentario(tema_id);
CREATE INDEX idx_comentario_padre_id ON comentario(comentario_padre_id);
-- Solo comentarios de Home de primer nivel, que son los que lista el feed.
CREATE INDEX idx_comentario_home ON comentario(contenido_id)
  WHERE es_home = TRUE AND comentario_padre_id IS NULL;

-- Historial de edición de comentario
CREATE TABLE historial_edicion_comentario (
  id                   BIGSERIAL PRIMARY KEY,
  comentario_id        BIGINT NOT NULL REFERENCES comentario(contenido_id) ON DELETE CASCADE,
  contenido_anterior   TEXT NOT NULL,
  contenido_nuevo      TEXT NOT NULL,
  editor_id            BIGINT NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  fecha_edicion        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reacciones
CREATE TABLE reaccion (
  id                BIGSERIAL PRIMARY KEY,
  usuario_id        BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  contenido_id      BIGINT NOT NULL REFERENCES contenido(id) ON DELETE CASCADE,
  tipo              tipo_reaccion NOT NULL,
  fecha_creacion    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, contenido_id) -- Una reacción por usuario y contenido
);

-- Reportes
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

-- Apelaciones
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

-- Notificaciones. Si el contenido se elimina, la notificación queda sin referencia.
CREATE TABLE notificacion (
  id                BIGSERIAL PRIMARY KEY,
  usuario_id        BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  tipo              VARCHAR(50) NOT NULL,
  mensaje           TEXT NOT NULL,
  contenido_id      BIGINT NULL REFERENCES contenido(id) ON DELETE SET NULL,
  -- Usuario que generó el evento; NULL en notificaciones del sistema.
  actor_id          BIGINT NULL REFERENCES usuario(id) ON DELETE SET NULL,
  -- Destino al hacer clic.
  url               VARCHAR(500) NULL,
  leida             BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_creacion    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Suscripciones push, una fila por dispositivo. `endpoint` identifica a la instalación:
-- por eso es UNIQUE y el upsert va por él.
CREATE TABLE push_suscripcion (
  id                BIGSERIAL PRIMARY KEY,
  usuario_id        BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  endpoint          VARCHAR(500) NOT NULL UNIQUE,
  -- Claves de cifrado del navegador; sin ellas el payload no se puede firmar.
  p256dh            TEXT NOT NULL,
  auth              TEXT NOT NULL,
  -- Solo diagnóstico.
  user_agent        VARCHAR(255) NULL,
  fecha_creacion    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cubre la búsqueda de todas las suscripciones de un usuario.
CREATE INDEX idx_push_suscripcion_usuario ON push_suscripcion(usuario_id);

-- Recuperación de contraseña
CREATE TABLE token_reset_password (
  id SERIAL PRIMARY KEY,
  usuario_id INTEGER NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  token VARCHAR(64) NOT NULL UNIQUE,
  expira_en TIMESTAMPTZ NOT NULL,
  usado BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Datos de una cuenta pendiente de verificación; el usuario se crea al confirmar el código.
CREATE TABLE verificacion_registro (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  codigo VARCHAR(6) NOT NULL,
  nickname VARCHAR(50) NOT NULL,
  nombre VARCHAR(120) NOT NULL,
  password_hash TEXT NOT NULL,
  -- Ver usuario.facultad.
  facultad VARCHAR(20),
  intentos INT NOT NULL DEFAULT 0,
  usado BOOLEAN NOT NULL DEFAULT FALSE,
  expira_en TIMESTAMPTZ NOT NULL,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_verificacion_registro_email ON verificacion_registro(email);

-- Contenido guardado: referencia a una categoría o a un contenido (tema o comentario, según `tipo`).
CREATE TABLE guardado (
  id BIGSERIAL PRIMARY KEY,
  usuario_id BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('categoria','tema','comentario')),
  categoria_id BIGINT REFERENCES categoria(id) ON DELETE CASCADE,
  contenido_id BIGINT REFERENCES contenido(id) ON DELETE CASCADE,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((categoria_id IS NOT NULL)::int + (contenido_id IS NOT NULL)::int = 1)
);
CREATE UNIQUE INDEX uq_guardado_categoria ON guardado(usuario_id, categoria_id) WHERE categoria_id IS NOT NULL;
CREATE UNIQUE INDEX uq_guardado_contenido ON guardado(usuario_id, contenido_id) WHERE contenido_id IS NOT NULL;


-- Suscripción a una categoría: avisa de temas nuevos y comentarios directos.
CREATE TABLE suscripcion_categoria (
  usuario_id     BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  categoria_id   BIGINT NOT NULL REFERENCES categoria(id) ON DELETE CASCADE,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, categoria_id)
);

-- Adjuntos de un comentario. estado: 'publicado', 'pendiente_revision' (imagen marcada por
-- el análisis) o 'rechazado' (la fila se conserva para el placeholder).
CREATE TABLE adjunto (
  id              BIGSERIAL PRIMARY KEY,
  contenido_id    BIGINT NOT NULL REFERENCES contenido(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  public_id       TEXT NOT NULL,           -- Para borrar el archivo
  nombre_original VARCHAR(255) NOT NULL,
  tipo            VARCHAR(20) NOT NULL,     -- 'imagen' o 'documento'
  tamano          INTEGER NOT NULL,         -- bytes
  estado          VARCHAR(20) NOT NULL DEFAULT 'publicado'
    CHECK (estado IN ('publicado', 'pendiente_revision', 'rechazado')),
  score_adult     VARCHAR(20),             -- Score del análisis (referencia para el admin)
  score_racy      VARCHAR(20),
  fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_adjunto_contenido ON adjunto(contenido_id);
-- Cola de revisión del admin: adjuntos de imagen pendientes.
CREATE INDEX idx_adjunto_pendiente ON adjunto(estado, fecha_creacion)
  WHERE estado = 'pendiente_revision';

-- Avatares y banners retenidos por moderación. El perfil no cambia hasta que un admin apruebe la imagen.
CREATE TABLE imagen_pendiente (
  id              BIGSERIAL PRIMARY KEY,
  usuario_id      BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  public_id       TEXT NOT NULL,
  tipo            VARCHAR(10) NOT NULL CHECK (tipo IN ('avatar', 'banner')),
  score_adult     VARCHAR(20),
  score_racy      VARCHAR(20),
  fecha_creacion  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_imagen_pendiente_fecha ON imagen_pendiente(fecha_creacion);
-- A lo sumo una imagen pendiente por usuario y tipo: una nueva reemplaza a la anterior.
CREATE UNIQUE INDEX idx_imagen_pendiente_usuario_tipo ON imagen_pendiente(usuario_id, tipo);

-- Encuestas de un comentario. Un comentario tiene a lo sumo una encuesta.
CREATE TABLE encuesta (
  id             BIGSERIAL PRIMARY KEY,
  contenido_id   BIGINT NOT NULL REFERENCES contenido(id) ON DELETE CASCADE,
  fecha_cierre   TIMESTAMPTZ NOT NULL,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX idx_encuesta_contenido ON encuesta(contenido_id);

CREATE TABLE encuesta_opcion (
  id          BIGSERIAL PRIMARY KEY,
  encuesta_id BIGINT NOT NULL REFERENCES encuesta(id) ON DELETE CASCADE,
  texto       VARCHAR(80) NOT NULL,
  orden       SMALLINT NOT NULL
);
CREATE INDEX idx_encuesta_opcion_encuesta ON encuesta_opcion(encuesta_id);

CREATE TABLE encuesta_voto (
  id             BIGSERIAL PRIMARY KEY,
  encuesta_id    BIGINT NOT NULL REFERENCES encuesta(id) ON DELETE CASCADE,
  opcion_id      BIGINT NOT NULL REFERENCES encuesta_opcion(id) ON DELETE CASCADE,
  usuario_id     BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (encuesta_id, usuario_id)
);
CREATE INDEX idx_encuesta_voto_opcion ON encuesta_voto(opcion_id);

-- Reportes de usuarios
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

-- Chat 1:1
CREATE TABLE conversacion (
  id                      BIGSERIAL PRIMARY KEY,
  usuario1_id             BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  usuario2_id             BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  ultimo_mensaje_at       TIMESTAMPTZ,
  borrado_por_usuario1_at TIMESTAMPTZ,
  borrado_por_usuario2_at TIMESTAMPTZ,
  fecha_creacion          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (usuario1_id < usuario2_id),
  UNIQUE (usuario1_id, usuario2_id)
);

CREATE TABLE mensaje (
  id                BIGSERIAL PRIMARY KEY,
  conversacion_id   BIGINT NOT NULL REFERENCES conversacion(id) ON DELETE CASCADE,
  autor_id          BIGINT NOT NULL REFERENCES usuario(id) ON DELETE RESTRICT,
  cuerpo            TEXT NOT NULL,
  leido             BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_creacion    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mensaje_conversacion ON mensaje(conversacion_id, fecha_creacion DESC);
CREATE INDEX idx_mensaje_autor ON mensaje(autor_id);
CREATE INDEX idx_conversacion_usuario1 ON conversacion(usuario1_id);
CREATE INDEX idx_conversacion_usuario2 ON conversacion(usuario2_id);

CREATE TABLE bloqueo (
  bloqueador_id  BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  bloqueado_id   BIGINT NOT NULL REFERENCES usuario(id) ON DELETE CASCADE,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bloqueador_id, bloqueado_id),
  CHECK (bloqueador_id <> bloqueado_id)
);

CREATE INDEX idx_bloqueo_bloqueado ON bloqueo(bloqueado_id);

-- Índices
CREATE INDEX idx_contenido_autor ON contenido(autor_id);
CREATE INDEX idx_tema_categoria ON tema(categoria_id);
CREATE INDEX idx_tema_estado ON tema(estado);
CREATE INDEX idx_categoria_estado ON categoria(estado);
CREATE INDEX idx_reporte_contenido ON reporte(contenido_id);
CREATE INDEX idx_reporte_categoria ON reporte(categoria_id) WHERE categoria_id IS NOT NULL;
CREATE UNIQUE INDEX uq_reporte_usuario_contenido ON reporte(usuario_id, contenido_id) WHERE contenido_id IS NOT NULL;
CREATE UNIQUE INDEX uq_reporte_usuario_categoria ON reporte(usuario_id, categoria_id) WHERE categoria_id IS NOT NULL;
CREATE INDEX idx_reaccion_contenido ON reaccion(contenido_id);
-- El filtro por etiqueta entra por etiqueta_id, segundo campo de la PK, que no lo cubre.
CREATE INDEX idx_cat_etiqueta_etiqueta ON categoria_etiqueta(etiqueta_id);

-- Índices de rendimiento
CREATE INDEX idx_comentario_categoria ON comentario(categoria_id) WHERE categoria_id IS NOT NULL;
CREATE INDEX idx_contenido_fecha ON contenido(fecha_creacion);
-- Las búsquedas usan LOWER(nickname) y LOWER(email): estos índices las cubren y garantizan
-- la unicidad sin distinguir mayúsculas.
CREATE UNIQUE INDEX uq_usuario_nickname_lower ON usuario (LOWER(nickname));
CREATE UNIQUE INDEX uq_usuario_email_lower ON usuario (LOWER(email));
CREATE INDEX idx_seguidor_seguido ON usuario_seguidor(seguido_id, estado);
CREATE INDEX idx_mensaje_no_leido ON mensaje(conversacion_id, autor_id) WHERE leido = FALSE;
CREATE INDEX idx_notificacion_actor ON notificacion(actor_id, tipo);
CREATE INDEX idx_notificacion_contenido ON notificacion(contenido_id);
CREATE INDEX idx_suscripcion_categoria_categoria ON suscripcion_categoria(categoria_id);
CREATE INDEX idx_participacion_categoria_categoria ON participacion_categoria(categoria_id);
CREATE INDEX idx_hist_edicion_comentario ON historial_edicion_comentario(comentario_id);
CREATE INDEX idx_hist_edicion_tema ON historial_edicion_tema(tema_id);
CREATE INDEX idx_hist_edicion_categoria ON historial_edicion_categoria(categoria_id);
CREATE INDEX idx_apelacion_autor ON apelacion(autor_id);

-- Índices parciales para listar contenido inactivado por moderación
CREATE INDEX idx_tema_moderacion
  ON tema (motivo_inactivacion)
  WHERE motivo_inactivacion = 'moderacion_reporte';

CREATE INDEX idx_comentario_moderacion
  ON comentario (motivo_inactivacion)
  WHERE motivo_inactivacion = 'moderacion_reporte';

-- Notificaciones
CREATE INDEX idx_notificacion_usuario ON notificacion(usuario_id, fecha_creacion DESC);
CREATE INDEX idx_notificacion_no_leida ON notificacion(usuario_id) WHERE leida = FALSE;

-- Se agregan acá porque contenido se crea después que categoria.
ALTER TABLE categoria
  ADD CONSTRAINT fk_categoria_tema_fijado FOREIGN KEY (tema_fijado_id) REFERENCES contenido(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_categoria_comentario_fijado FOREIGN KEY (comentario_fijado_id) REFERENCES contenido(id) ON DELETE SET NULL;

-- A lo sumo una categoría fijada en el Home.
CREATE UNIQUE INDEX uq_categoria_fijada_home
  ON categoria ((fijada_hasta IS NOT NULL))
  WHERE fijada_hasta IS NOT NULL;

-- A lo sumo un comentario de Home fijado. El destacado es único junto con la categoría fijada;
-- el cruce lo garantiza la aplicación.
CREATE UNIQUE INDEX uq_comentario_fijado_home
  ON comentario ((fijado_home_hasta IS NOT NULL))
  WHERE fijado_home_hasta IS NOT NULL;