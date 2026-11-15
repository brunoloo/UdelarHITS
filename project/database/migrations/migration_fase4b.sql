-- Apelaciones

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_apelacion_pendiente
  ON apelacion (contenido_id)
  WHERE estado = 'pendiente';

COMMIT;