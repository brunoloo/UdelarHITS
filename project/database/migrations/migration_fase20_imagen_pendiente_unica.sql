-- ============================================================
-- Fase 20 — Superseding de avatar/banner pendiente de revisión
-- ============================================================
-- Contexto: cuando un usuario tenía un avatar/banner retenido por moderación
-- (imagen A en `imagen_pendiente`) y subía otro sin esperar la resolución
-- (imagen B), ambas filas coexistían. Si un admin aprobaba A después, se
-- revertía la foto del usuario a la versión vieja, pisando la B en Cloudinary.
--
-- Solución: a lo sumo UNA imagen pendiente por usuario y tipo. El upload
-- descarta el pendiente anterior antes de procesar el nuevo (superseding), y
-- este índice único lo garantiza a nivel base de datos.
--
-- No es un índice PARCIAL (sin WHERE) a propósito: usuario_id y tipo son NOT
-- NULL y toda fila de la tabla ES un pendiente vigente, así que la unicidad
-- aplica a todas las filas.

-- 1. Deduplicar filas preexistentes (quedarse con la más reciente por
--    usuario+tipo) para que el índice único se pueda crear sin conflictos.
--    Nota: los assets de Cloudinary de las filas borradas acá no se limpian
--    (SQL no puede); son residuos puntuales de datos previos a esta migración.
DELETE FROM imagen_pendiente ip
USING imagen_pendiente mas_nueva
WHERE ip.usuario_id = mas_nueva.usuario_id
  AND ip.tipo = mas_nueva.tipo
  AND ip.id < mas_nueva.id;

-- 2. Índice único: a lo sumo un avatar/banner pendiente por usuario y tipo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_imagen_pendiente_usuario_tipo
  ON imagen_pendiente(usuario_id, tipo);
