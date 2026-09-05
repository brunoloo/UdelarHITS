-- =========================================================
-- Migración Fase 24 — Facultad del usuario en el perfil
-- =========================================================
-- Idempotente. Para la base de DESARROLLO (udelarhits).
-- Reflejado también en schema.sql (la base de test se recrea desde ahí).
--
-- Campo opcional del perfil, separado de la biografía: indica a qué facultad de
-- la Udelar pertenece el usuario. Guarda la ABREVIATURA del catálogo `etiqueta`
-- con grupo = 'Facultades' (p. ej. 'FING', 'FPsico', 'FOdont'), que es lo que se
-- muestra como etiqueta al lado del nickname cuando el usuario participa. El
-- nombre completo que se ve en el perfil ("Facultad de Ingeniería") lo compone
-- el backend a partir de etiqueta.nombre_display.
--
-- Sin FK a `etiqueta`, deliberadamente: la abreviatura viaja junto al autor en
-- ~30 queries de contenido (temas, comentarios, feed, tarjetas de categoría) y
-- una FK obligaría a sumar un JOIN en todas ellas. La validación contra el
-- catálogo se hace en el service al guardar el perfil.
--
-- NULL = sin especificar. Sin índice: no se filtra ni ordena por este campo.
--
-- La misma columna va en `verificacion_registro`: el registro es de dos pasos
-- (datos → código por email) y la cuenta recién se crea al confirmar el código,
-- así que la facultad elegida en el formulario tiene que sobrevivir en la fila
-- pendiente hasta ese momento. También se copia al reenviar el código.
--
-- Ejecutar:
--   psql -h localhost -U <usuario> -d udelarhits -f migrations/migration_fase24_usuario_facultad.sql
-- =========================================================

BEGIN;

ALTER TABLE usuario
  ADD COLUMN IF NOT EXISTS facultad VARCHAR(20) NULL;

ALTER TABLE verificacion_registro
  ADD COLUMN IF NOT EXISTS facultad VARCHAR(20) NULL;

COMMIT;
