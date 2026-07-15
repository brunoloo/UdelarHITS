import pool from '../config/db.js';

// Repositorio de la cola de revisión de imágenes moderadas. Unifica dos fuentes:
//   * adjunto con estado 'pendiente_revision' (imágenes de comentarios)
//   * imagen_pendiente (avatares/banners retenidos)

// --- Listado para la cola del admin ---------------------------------------

// Adjuntos de imagen pendientes, con autor y contexto (tema o categoría).
const listPendingAdjuntos = async () => {
  const q = `
    SELECT a.id, a.url, a.score_adult, a.score_racy, a.fecha_creacion,
           u.nickname AS autor_nickname,
           com.tema_id, com.categoria_id,
           t.titulo AS tema_titulo,
           catd.titulo AS categoria_titulo
    FROM adjunto a
    JOIN contenido con ON con.id = a.contenido_id
    JOIN usuario u ON u.id = con.autor_id
    JOIN comentario com ON com.contenido_id = a.contenido_id
    LEFT JOIN tema t ON t.contenido_id = com.tema_id
    LEFT JOIN categoria catd ON catd.id = com.categoria_id
    WHERE a.estado = 'pendiente_revision'
    ORDER BY a.fecha_creacion ASC
  `;
  const { rows } = await pool.query(q);
  return rows;
};

// Avatares/banners retenidos, con el autor.
const listPendingImagenes = async () => {
  const q = `
    SELECT ip.id, ip.url, ip.tipo, ip.score_adult, ip.score_racy, ip.fecha_creacion,
           u.nickname AS autor_nickname
    FROM imagen_pendiente ip
    JOIN usuario u ON u.id = ip.usuario_id
    ORDER BY ip.fecha_creacion ASC
  `;
  const { rows } = await pool.query(q);
  return rows;
};

// --- Lecturas puntuales (para aprobar/rechazar) ---------------------------

// Adjunto pendiente + autor del comentario (para Cloudinary y notificación).
const getPendingAdjunto = async (id) => {
  const q = `
    SELECT a.id, a.public_id, a.tipo, a.contenido_id, a.estado, con.autor_id
    FROM adjunto a
    JOIN contenido con ON con.id = a.contenido_id
    WHERE a.id = $1
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
};

const getPendingImagen = async (id) => {
  const q = `SELECT id, usuario_id, url, public_id, tipo FROM imagen_pendiente WHERE id = $1`;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
};

// --- Mutaciones sobre adjunto ---------------------------------------------

const approveAdjunto = async (id) => {
  const q = `
    UPDATE adjunto
    SET estado = 'publicado', score_adult = NULL, score_racy = NULL
    WHERE id = $1 AND estado = 'pendiente_revision'
    RETURNING id
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
};

// Rechazo: mantiene la fila (para el placeholder "eliminada por moderación")
// pero limpia url/public_id (ya no apunta a nada en Cloudinary) y los scores.
const markAdjuntoRejected = async (id) => {
  const q = `
    UPDATE adjunto
    SET estado = 'rechazado', url = '', public_id = '', score_adult = NULL, score_racy = NULL
    WHERE id = $1 AND estado = 'pendiente_revision'
    RETURNING id
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
};

// --- Mutaciones sobre imagen_pendiente (avatar/banner) --------------------

// Aprueba: escribe la columna en `usuario` y borra la fila pendiente, atómico.
// `finalUrl` es la URL canónica (ya movida en Cloudinary por el service); si no
// se pasa, cae a la URL pendiente guardada en la fila.
const promotePendingImagen = async (id, finalUrl = null) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `SELECT usuario_id, url, tipo FROM imagen_pendiente WHERE id = $1 FOR UPDATE`, [id]
    );
    const row = rows[0];
    if (!row) {
      await client.query('ROLLBACK');
      return null;
    }
    const col = row.tipo === 'avatar' ? 'url_imagen' : 'url_banner';
    const url = finalUrl || row.url;
    await client.query(`UPDATE usuario SET ${col} = $1 WHERE id = $2`, [url, row.usuario_id]);
    await client.query(`DELETE FROM imagen_pendiente WHERE id = $1`, [id]);
    await client.query('COMMIT');
    return { ...row, url };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const deletePendingImagen = async (id) => {
  const q = `DELETE FROM imagen_pendiente WHERE id = $1 RETURNING usuario_id, public_id, tipo`;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
};

// --- Auto-descarte a las N horas (cron) -----------------------------------

const getExpiredPendingAdjuntos = async (hours) => {
  const q = `
    SELECT a.id, a.public_id, a.tipo, a.contenido_id, con.autor_id
    FROM adjunto a
    JOIN contenido con ON con.id = a.contenido_id
    WHERE a.estado = 'pendiente_revision'
      AND a.fecha_creacion < NOW() - make_interval(hours => $1)
  `;
  const { rows } = await pool.query(q, [hours]);
  return rows;
};

const getExpiredPendingImagenes = async (hours) => {
  const q = `
    SELECT id, usuario_id, public_id, tipo
    FROM imagen_pendiente
    WHERE fecha_creacion < NOW() - make_interval(hours => $1)
  `;
  const { rows } = await pool.query(q, [hours]);
  return rows;
};

// Inserta una imagen de avatar/banner retenida por moderación.
const createPendingImagen = async ({ usuarioId, url, publicId, tipo, scoreAdult = null, scoreRacy = null }) => {
  const q = `
    INSERT INTO imagen_pendiente (usuario_id, url, public_id, tipo, score_adult, score_racy)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, usuario_id, url, public_id, tipo
  `;
  const { rows } = await pool.query(q, [usuarioId, url, publicId, tipo, scoreAdult, scoreRacy]);
  return rows[0];
};

export {
  listPendingAdjuntos, listPendingImagenes,
  getPendingAdjunto, getPendingImagen,
  approveAdjunto, markAdjuntoRejected,
  promotePendingImagen, deletePendingImagen,
  getExpiredPendingAdjuntos, getExpiredPendingImagenes,
  createPendingImagen,
};
