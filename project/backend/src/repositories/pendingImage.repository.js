import pool from '../config/db.js';

// Cola de revisión: adjuntos en 'pendiente_revision' y avatares o banners retenidos (imagen_pendiente).

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

// Devuelve un array por si quedan filas previas al índice único (usuario_id, tipo).
const getPendingImagenesByUserTipo = async (usuarioId, tipo) => {
  const q = `SELECT id, public_id FROM imagen_pendiente WHERE usuario_id = $1 AND tipo = $2`;
  const { rows } = await pool.query(q, [usuarioId, tipo]);
  return rows;
};

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

// Conserva la fila para el placeholder, sin url ni public_id.
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

// `finalUrl` es la URL definitiva; sin ella se usa la guardada en la fila.
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

    // Si hay una fila pendiente más nueva del mismo usuario y tipo, esta quedó superada:
    // aprobarla revertiría la imagen a una versión vieja.
    const { rows: newer } = await client.query(
      `SELECT 1 FROM imagen_pendiente WHERE usuario_id = $1 AND tipo = $2 AND id > $3 LIMIT 1`,
      [row.usuario_id, row.tipo, id]
    );
    if (newer.length > 0) {
      await client.query('ROLLBACK');
      return { stale: true };
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
  getPendingAdjunto, getPendingImagen, getPendingImagenesByUserTipo,
  approveAdjunto, markAdjuntoRejected,
  promotePendingImagen, deletePendingImagen,
  getExpiredPendingAdjuntos, getExpiredPendingImagenes,
  createPendingImagen,
};
