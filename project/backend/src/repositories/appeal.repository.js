import pool from '../config/db.js';

// ---------------------------------------------------------
// Inserta una apelación. El título lo arma el service (no el usuario).
// El UNIQUE parcial uq_apelacion_pendiente atrapa el doble-submit (23505).
// ---------------------------------------------------------
const createAppeal = async ({ contenido_id = null, categoria_id = null, autor_id, titulo, justificacion }) => {
  const q = `
    INSERT INTO apelacion (contenido_id, categoria_id, autor_id, titulo, justificacion)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, contenido_id, categoria_id, autor_id, titulo, justificacion, estado, fecha_solicitud
  `;
  const { rows } = await pool.query(q, [contenido_id, categoria_id, autor_id, titulo, justificacion]);
  return rows[0];
};

// ---------------------------------------------------------
// ¿Ya hay una apelación pendiente sobre este contenido?
// ---------------------------------------------------------
const hasPendingAppeal = async (contenidoId = null, categoriaId = null) => {
  if (contenidoId) {
    const { rows } = await pool.query(
      `SELECT EXISTS(SELECT 1 FROM apelacion WHERE contenido_id = $1 AND estado = 'pendiente') AS pendiente`,
      [contenidoId]
    );
    return rows[0].pendiente;
  }
  const { rows } = await pool.query(
    `SELECT EXISTS(SELECT 1 FROM apelacion WHERE categoria_id = $1 AND estado = 'pendiente') AS pendiente`,
    [categoriaId]
  );
  return rows[0].pendiente;
};

// ---------------------------------------------------------
// Trae una apelación por id, con el cuerpo del contenido y su tipo.
// Para la vista de resolución del admin.
// ---------------------------------------------------------
const getAppealById = async (id) => {
  const q = `
    SELECT a.id, a.contenido_id, a.categoria_id, a.autor_id, a.titulo, a.justificacion,
      a.estado, a.fecha_solicitud,
      CASE
        WHEN a.contenido_id IS NOT NULL AND t.contenido_id IS NOT NULL THEN 'tema'
        WHEN a.contenido_id IS NOT NULL AND c.contenido_id IS NOT NULL THEN 'comentario'
        WHEN a.categoria_id IS NOT NULL THEN 'categoria'
        ELSE NULL
      END AS tipo,
      COALESCE(con.cuerpo, cat_data.descripcion) AS contenido_cuerpo
    FROM apelacion a
    LEFT JOIN contenido con ON con.id = a.contenido_id
    LEFT JOIN tema t ON t.contenido_id = a.contenido_id
    LEFT JOIN comentario c ON c.contenido_id = a.contenido_id
    LEFT JOIN categoria cat_data ON cat_data.id = a.categoria_id
    WHERE a.id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
};

// ---------------------------------------------------------
// Lista apelaciones pendientes filtradas por tipo ('tema' | 'comentario').
// Los casos de uso piden listas separadas por tipo en el panel admin.
// ---------------------------------------------------------
const getPendingAppealsByType = async (tipo) => {
  let q;
 
  if (tipo === 'tema') {
    q = `
      SELECT a.id, a.contenido_id, a.autor_id, a.titulo, a.justificacion,
        a.estado, a.fecha_solicitud,
        u.nickname AS autor_nickname,
        con.cuerpo AS contenido_cuerpo,
        regexp_replace(t.titulo, '_deleted_' || t.contenido_id || '$', '') AS tema_titulo,
        cat.titulo AS categoria_titulo
      FROM apelacion a
      JOIN contenido con ON con.id = a.contenido_id
      JOIN usuario u ON u.id = a.autor_id
      JOIN tema t ON t.contenido_id = a.contenido_id
      JOIN categoria cat ON cat.id = t.categoria_id
      WHERE a.estado = 'pendiente'
      ORDER BY a.fecha_solicitud ASC
    `;
  } else if (tipo === 'comentario') {
    q = `
      SELECT a.id, a.contenido_id, a.autor_id, a.titulo, a.justificacion,
        a.estado, a.fecha_solicitud,
        u.nickname AS autor_nickname,
        con.cuerpo AS contenido_cuerpo
      FROM apelacion a
      JOIN contenido con ON con.id = a.contenido_id
      JOIN usuario u ON u.id = a.autor_id
      JOIN comentario c ON c.contenido_id = a.contenido_id
      WHERE a.estado = 'pendiente'
      ORDER BY a.fecha_solicitud ASC
    `;
  } else if (tipo === 'categoria') {
    q = `
      SELECT a.id, a.categoria_id, a.autor_id, a.titulo, a.justificacion,
        a.estado, a.fecha_solicitud,
        u.nickname AS autor_nickname,
        cat.descripcion AS contenido_cuerpo,
        cat.titulo AS categoria_titulo
      FROM apelacion a
      JOIN categoria cat ON cat.id = a.categoria_id
      JOIN usuario u ON u.id = a.autor_id
      WHERE a.estado = 'pendiente'
      ORDER BY a.fecha_solicitud ASC
    `;
  }
 
  const { rows } = await pool.query(q);
  return rows;
};

// ---------------------------------------------------------
// Borra una apelación por id (al resolver se elimina, sea aceptada o
// rechazada). Acepta client para usarse dentro de transacción.
// ---------------------------------------------------------
const deleteAppealById = async (id, client = pool) => {
  const q = `DELETE FROM apelacion WHERE id = $1 RETURNING id`;
  const { rows } = await client.query(q, [id]);
  return rows[0] || null;
};

const getModeratedContentByUserId = async (userId) => {
  const q = `
    SELECT con.id AS contenido_id, NULL::bigint AS categoria_id, con.cuerpo, 'tema' AS tipo,
      t.fecha_inactivacion,
      t.titulo AS contenido_titulo,
      EXISTS(SELECT 1 FROM apelacion a WHERE a.contenido_id = con.id AND a.estado = 'pendiente') AS tiene_apelacion_pendiente
    FROM contenido con
    JOIN tema t ON t.contenido_id = con.id
    WHERE con.autor_id = $1
      AND t.motivo_inactivacion = 'moderacion_reporte'
      AND t.inactivado_directo = TRUE

    UNION ALL

    SELECT con.id AS contenido_id, NULL::bigint AS categoria_id, con.cuerpo, 'comentario' AS tipo,
      c.fecha_inactivacion,
      NULL AS contenido_titulo,
      EXISTS(SELECT 1 FROM apelacion a WHERE a.contenido_id = con.id AND a.estado = 'pendiente') AS tiene_apelacion_pendiente
    FROM contenido con
    JOIN comentario c ON c.contenido_id = con.id
    WHERE con.autor_id = $1
      AND c.motivo_inactivacion = 'moderacion_reporte'
      AND c.inactivado_directo = TRUE

    UNION ALL

    SELECT NULL::bigint AS contenido_id, cat.id AS categoria_id, cat.descripcion AS cuerpo, 'categoria' AS tipo,
      cat.fecha_inactivacion,
      cat.titulo AS contenido_titulo,
      EXISTS(SELECT 1 FROM apelacion a WHERE a.categoria_id = cat.id AND a.estado = 'pendiente') AS tiene_apelacion_pendiente
    FROM categoria cat
    WHERE cat.autor_id = $1
      AND cat.motivo_inactivacion = 'moderacion_reporte'

    ORDER BY fecha_inactivacion DESC
  `;
  const { rows } = await pool.query(q, [userId]);
  return rows;
};

export { createAppeal, hasPendingAppeal, getAppealById, getPendingAppealsByType, 
  deleteAppealById, getModeratedContentByUserId };