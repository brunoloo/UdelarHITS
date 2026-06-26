import pool from '../config/db.js';

// Inserta un adjunto asociado a un contenido (comentario).
const createAttachment = async ({ contenidoId, url, publicId, nombreOriginal, tipo, tamano }) => {
  const q = `
    INSERT INTO adjunto (contenido_id, url, public_id, nombre_original, tipo, tamano)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, url, nombre_original, tipo, tamano
  `;
  const { rows } = await pool.query(q, [contenidoId, url, publicId, nombreOriginal, tipo, tamano]);
  return rows[0];
};

// Adjuntos visibles de un comentario (los que se devuelven al cliente).
const getAttachmentsByContenidoId = async (contenidoId) => {
  const q = `
    SELECT id, url, nombre_original, tipo, tamano
    FROM adjunto WHERE contenido_id = $1 ORDER BY id
  `;
  const { rows } = await pool.query(q, [contenidoId]);
  return rows;
};

// Incluye public_id/tipo: necesario para borrar de Cloudinary antes del hard delete.
const getAttachmentsForDeletion = async (contenidoId) => {
  const q = `SELECT public_id, tipo FROM adjunto WHERE contenido_id = $1`;
  const { rows } = await pool.query(q, [contenidoId]);
  return rows;
};

export { createAttachment, getAttachmentsByContenidoId, getAttachmentsForDeletion };
