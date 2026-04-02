-- =========================================================
-- PATCH V2 - Reglas de negocio faltantes
-- PostgreSQL
-- =========================================================

-- ---------------------------------------------------------
-- 1) Tabla administrador + referencia en apelacion
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS administrador (
  id                BIGSERIAL PRIMARY KEY,
  nombre            VARCHAR(120) NOT NULL,
  email             VARCHAR(255) NOT NULL UNIQUE,
  password_hash     TEXT NOT NULL,
  activo            BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE apelacion
  ADD COLUMN IF NOT EXISTS resuelto_por_admin_id BIGINT NULL REFERENCES administrador(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS resolucion_comentario TEXT NULL;

-- ---------------------------------------------------------
-- 2) Validar comentario_padre en el mismo tema
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validar_padre_mismo_tema()
RETURNS TRIGGER AS $$
DECLARE
  v_tema_padre BIGINT;
BEGIN
  IF NEW.comentario_padre_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.tema_id
    INTO v_tema_padre
  FROM comentario c
  WHERE c.contenido_id = NEW.comentario_padre_id;

  IF v_tema_padre IS NULL THEN
    RAISE EXCEPTION 'comentario_padre_id % no existe', NEW.comentario_padre_id;
  END IF;

  IF v_tema_padre <> NEW.tema_id THEN
    RAISE EXCEPTION 'El comentario padre debe pertenecer al mismo tema';
  END IF;

  IF NEW.comentario_padre_id = NEW.contenido_id THEN
    RAISE EXCEPTION 'Un comentario no puede responderse a sí mismo';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_padre_mismo_tema ON comentario;
CREATE TRIGGER trg_validar_padre_mismo_tema
BEFORE INSERT OR UPDATE OF comentario_padre_id, tema_id
ON comentario
FOR EACH ROW
EXECUTE FUNCTION fn_validar_padre_mismo_tema();

-- ---------------------------------------------------------
-- 3) Validar apelación: apelador debe ser autor del contenido
--    y el contenido debe estar oculto/inactivo
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_validar_apelacion()
RETURNS TRIGGER AS $$
DECLARE
  v_autor_id BIGINT;
  v_estado_tema estado_tem;
  v_estado_com estado_com;
  v_es_tema BOOLEAN;
  v_es_comentario BOOLEAN;
BEGIN
  SELECT autor_id INTO v_autor_id
  FROM contenido
  WHERE id = NEW.contenido_id;

  IF v_autor_id IS NULL THEN
    RAISE EXCEPTION 'contenido_id % no existe', NEW.contenido_id;
  END IF;

  IF v_autor_id <> NEW.autor_id THEN
    RAISE EXCEPTION 'Solo el autor del contenido puede iniciar apelación';
  END IF;

  SELECT EXISTS(SELECT 1 FROM tema t WHERE t.contenido_id = NEW.contenido_id) INTO v_es_tema;
  SELECT EXISTS(SELECT 1 FROM comentario c WHERE c.contenido_id = NEW.contenido_id) INTO v_es_comentario;

  IF NOT v_es_tema AND NOT v_es_comentario THEN
    RAISE EXCEPTION 'El contenido apelado debe ser tema o comentario';
  END IF;

  IF v_es_tema THEN
    SELECT estado INTO v_estado_tema FROM tema WHERE contenido_id = NEW.contenido_id;
    IF v_estado_tema <> 'inactivo' THEN
      RAISE EXCEPTION 'Solo se puede apelar un tema en estado inactivo';
    END IF;
  END IF;

  IF v_es_comentario THEN
    SELECT estado INTO v_estado_com FROM comentario WHERE contenido_id = NEW.contenido_id;
    IF v_estado_com <> 'oculto' THEN
      RAISE EXCEPTION 'Solo se puede apelar un comentario en estado oculto';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validar_apelacion ON apelacion;
CREATE TRIGGER trg_validar_apelacion
BEFORE INSERT OR UPDATE OF contenido_id, autor_id
ON apelacion
FOR EACH ROW
EXECUTE FUNCTION fn_validar_apelacion();

-- ---------------------------------------------------------
-- 4) Auto-asignar moderador al crear categoría (autor)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_asignar_moderador_categoria()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO participacion_categoria(usuario_id, categoria_id, rol)
  VALUES (NEW.autor_id, NEW.id, 'moderador')
  ON CONFLICT (usuario_id, categoria_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_asignar_moderador_categoria ON categoria;
CREATE TRIGGER trg_asignar_moderador_categoria
AFTER INSERT ON categoria
FOR EACH ROW
EXECUTE FUNCTION fn_asignar_moderador_categoria();

-- ---------------------------------------------------------
-- 5) Auto-asignar participante al crear tema/comentario
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_asignar_participante_por_tema()
RETURNS TRIGGER AS $$
DECLARE
  v_autor_id BIGINT;
BEGIN
  SELECT autor_id INTO v_autor_id
  FROM contenido
  WHERE id = NEW.contenido_id;

  IF v_autor_id IS NOT NULL THEN
    INSERT INTO participacion_categoria(usuario_id, categoria_id, rol)
    VALUES (v_autor_id, NEW.categoria_id, 'participante')
    ON CONFLICT (usuario_id, categoria_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_asignar_participante_por_tema ON tema;
CREATE TRIGGER trg_asignar_participante_por_tema
AFTER INSERT ON tema
FOR EACH ROW
EXECUTE FUNCTION fn_asignar_participante_por_tema();

CREATE OR REPLACE FUNCTION fn_asignar_participante_por_comentario()
RETURNS TRIGGER AS $$
DECLARE
  v_autor_id BIGINT;
  v_categoria_id BIGINT;
BEGIN
  SELECT autor_id INTO v_autor_id
  FROM contenido
  WHERE id = NEW.contenido_id;

  SELECT t.categoria_id INTO v_categoria_id
  FROM tema t
  WHERE t.contenido_id = NEW.tema_id;

  IF v_autor_id IS NOT NULL AND v_categoria_id IS NOT NULL THEN
    INSERT INTO participacion_categoria(usuario_id, categoria_id, rol)
    VALUES (v_autor_id, v_categoria_id, 'participante')
    ON CONFLICT (usuario_id, categoria_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_asignar_participante_por_comentario ON comentario;
CREATE TRIGGER trg_asignar_participante_por_comentario
AFTER INSERT ON comentario
FOR EACH ROW
EXECUTE FUNCTION fn_asignar_participante_por_comentario();

-- ---------------------------------------------------------
-- 6) Bloquear publicaciones en categoría/tema inactivo
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_bloquear_publicacion_en_inactivos()
RETURNS TRIGGER AS $$
DECLARE
  v_estado_cat estado_cat;
  v_estado_tema estado_tem;
BEGIN
  -- Inserción de tema: categoría debe estar activa
  IF TG_TABLE_NAME = 'tema' THEN
    SELECT estado INTO v_estado_cat
    FROM categoria
    WHERE id = NEW.categoria_id;

    IF v_estado_cat <> 'activa' THEN
      RAISE EXCEPTION 'No se puede publicar tema en categoría inactiva';
    END IF;
  END IF;

  -- Inserción de comentario: tema activo y categoría activa
  IF TG_TABLE_NAME = 'comentario' THEN
    SELECT t.estado, c.estado
      INTO v_estado_tema, v_estado_cat
    FROM tema t
    JOIN categoria c ON c.id = t.categoria_id
    WHERE t.contenido_id = NEW.tema_id;

    IF v_estado_tema <> 'activo' THEN
      RAISE EXCEPTION 'No se puede publicar comentario en tema inactivo';
    END IF;

    IF v_estado_cat <> 'activa' THEN
      RAISE EXCEPTION 'No se puede publicar comentario en categoría inactiva';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bloquear_tema_en_categoria_inactiva ON tema;
CREATE TRIGGER trg_bloquear_tema_en_categoria_inactiva
BEFORE INSERT ON tema
FOR EACH ROW
EXECUTE FUNCTION fn_bloquear_publicacion_en_inactivos();

DROP TRIGGER IF EXISTS trg_bloquear_comentario_en_inactivos ON comentario;
CREATE TRIGGER trg_bloquear_comentario_en_inactivos
BEFORE INSERT ON comentario
FOR EACH ROW
EXECUTE FUNCTION fn_bloquear_publicacion_en_inactivos();

-- ---------------------------------------------------------
-- 7) Mantener contador_temas en categoria
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_incrementar_contador_temas()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE categoria
     SET contador_temas = contador_temas + 1
   WHERE id = NEW.categoria_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION fn_decrementar_contador_temas()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE categoria
     SET contador_temas = GREATEST(contador_temas - 1, 0)
   WHERE id = OLD.categoria_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_incrementar_contador_temas ON tema;
CREATE TRIGGER trg_incrementar_contador_temas
AFTER INSERT ON tema
FOR EACH ROW
EXECUTE FUNCTION fn_incrementar_contador_temas();

DROP TRIGGER IF EXISTS trg_decrementar_contador_temas ON tema;
CREATE TRIGGER trg_decrementar_contador_temas
AFTER DELETE ON tema
FOR EACH ROW
EXECUTE FUNCTION fn_decrementar_contador_temas();