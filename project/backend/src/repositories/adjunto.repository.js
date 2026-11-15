import pool from '../config/db.js';

const createAttachment = async ({
  contenidoId, url, publicId, nombreOriginal, tipo, tamano,
  estado = 'publicado', scoreAdult = null, scoreRacy = null,
}) => {
  const q = `
    INSERT INTO adjunto (contenido_id, url, public_id, nombre_original, tipo, tamano, estado, score_adult, score_racy)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, url, nombre_original, tipo, tamano, estado
  `;
  const { rows } = await pool.query(q, [contenidoId, url, publicId, nombreOriginal, tipo, tamano, estado, scoreAdult, scoreRacy]);
  return rows[0];
};

const getAttachmentsByContenidoId = async (contenidoId) => {
  const q = `
    SELECT id, url, nombre_original, tipo, tamano, estado
    FROM adjunto WHERE contenido_id = $1 ORDER BY id
  `;
  const { rows } = await pool.query(q, [contenidoId]);
  return rows;
};

// Incluye public_id y tipo, necesarios para borrar el archivo antes del hard delete.
const getAttachmentsForDeletion = async (contenidoId) => {
  const q = `SELECT public_id, tipo FROM adjunto WHERE contenido_id = $1`;
  const { rows } = await pool.query(q, [contenidoId]);
  return rows;
};

export { createAttachment, getAttachmentsByContenidoId, getAttachmentsForDeletion };
