import pool from '../config/db.js';

const findByEmailOrNickname = async ({ nickname, email }) => {
  const q = `
    SELECT nickname, email
    FROM usuario
    WHERE LOWER(nickname) = LOWER($1) OR LOWER(email) = LOWER($2)
  `;
  const { rows } = await pool.query(q, [nickname, email]);

  return {
    nicknameTaken: rows.some((r) => r.nickname.toLowerCase() === nickname.toLowerCase()),
    emailTaken: rows.some((r) => r.email.toLowerCase() === email.toLowerCase()),
  };
};

const findByEmailOrNicknameForLogin = async ({ nickname, email }) => {
  let q = `
    SELECT id, nickname, nombre, email, password_hash, biografia, url_imagen, estado, rol
    FROM usuario
  `;
  const values = [];

  if (nickname && email) {
    q += ` WHERE LOWER(nickname) = LOWER($1) OR LOWER(email) = LOWER($2) LIMIT 1`;
    values.push(nickname, email);
  } else if (nickname) {
    q += ` WHERE LOWER(nickname) = LOWER($1) LIMIT 1`;
    values.push(nickname);
  } else {
    q += ` WHERE LOWER(email) = LOWER($1) LIMIT 1`;
    values.push(email);
  }

  const { rows } = await pool.query(q, values);
  return rows[0] || null;
};

const createUser = async ({ nickname, nombre, email, passwordHash, rol = 'user' }) => {
  const q = `
    INSERT INTO usuario (nickname, nombre, email, password_hash, rol)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, nickname, nombre, email, rol
  `;
  const { rows } = await pool.query(q, [nickname, nombre, email, passwordHash, rol]);
  return rows[0];
};

const getUsers = async () => {
  const q = `
    SELECT id, nickname, nombre, email, rol, url_imagen, estado, fecha_creacion
    FROM usuario
    ORDER BY id ASC
  `;
  const { rows } = await pool.query(q);
  return rows;
};

const getUserByNickname = async (nickname) => {
  const q = `
    SELECT id, rol, nickname, nombre, email, biografia, url_imagen, url_banner, fecha_creacion, estado, privado, me_gusta_privado
    FROM usuario
    WHERE LOWER(nickname) = LOWER($1)
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [nickname]);
  return rows[0] || null;
};

const getUserIdByNickname = async (nickname) => {
  const q = `
    SELECT id
    FROM usuario
    WHERE LOWER(nickname) = LOWER($1)
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [nickname]);
  return rows[0]?.id || null;
};

const getCategoriesByUserId = async (userId) => {
  const q = `
    SELECT c.id, c.titulo, c.descripcion, c.fecha_creacion, c.icono,
      (SELECT COUNT(*) FROM tema t WHERE t.categoria_id = c.id AND t.estado = 'activo') AS contador_temas,
      ARRAY_AGG(ce.etiqueta_valor) AS etiquetas
    FROM categoria c
    LEFT JOIN categoria_etiqueta ce ON ce.categoria_id = c.id
    WHERE c.autor_id = $1 AND c.estado = 'activa'
    GROUP BY c.id
    ORDER BY c.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q, [userId]);
  return rows;
};

const getFollowersByUserId = async (userId) => {
  const q = `
    SELECT u.id, u.nickname, u.nombre, u.url_imagen
    FROM usuario_seguidor us
    JOIN usuario u ON u.id = us.seguidor_id
    WHERE us.seguido_id = $1 AND us.estado = 'aceptado'
    ORDER BY us.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q, [userId]);
  return rows;
};

const getFollowingByUserId = async (userId) => {
  const q = `
    SELECT u.id, u.nickname, u.nombre, u.url_imagen
    FROM usuario_seguidor us
    JOIN usuario u ON u.id = us.seguido_id
    WHERE us.seguidor_id = $1 AND us.estado = 'aceptado'
    ORDER BY us.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q, [userId]);
  return rows;
};

const updateUserById = async (id, { nombre, biografia }) => {
  const fields = [];
  const values = [];
  let idx = 1;

  if (nombre !== undefined) {
    fields.push(`nombre = $${idx++}`);
    values.push(nombre);
  }
  if (biografia !== undefined) {
    fields.push(`biografia = $${idx++}`);
    values.push(biografia);
  }

  if (fields.length === 0) return null;

  values.push(id);
  const q = `
    UPDATE usuario
    SET ${fields.join(', ')}
    WHERE id = $${idx}
    RETURNING id, nickname, nombre, email, biografia, url_imagen
  `;
  const { rows } = await pool.query(q, values);
  return rows[0] || null;
};

const getUserAvatarUrlById = async (id) => {
  const q = `
    SELECT url_imagen
    FROM usuario
    WHERE id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [id]);
  if (rows.length === 0) return undefined; // no existe
  return rows[0].url_imagen; // puede ser null
};

const updateAvatarById = async (id, url_imagen) => {
  const q = `
    UPDATE usuario SET url_imagen = $1
    WHERE id = $2
    RETURNING id, url_imagen
  `;
  const { rows } = await pool.query(q, [url_imagen, id]);
  return rows[0] || null;
};

const updateUserEstado = async (nickname, estado) => {
  const q = `
    UPDATE usuario
    SET estado = $1
    WHERE LOWER(nickname) = LOWER($2)
    RETURNING id, nickname, estado
  `;
  const { rows } = await pool.query(q, [estado, nickname]);
  return rows[0] || null;
};

const updateUserEstadoById = async (userId, estado) => {
  const q = `
    UPDATE usuario
    SET estado = $1
    WHERE id = $2
    RETURNING id, nickname, estado
  `;
  const { rows } = await pool.query(q, [estado, userId]);
  return rows[0] || null;
};

const deleteUserByNickname = async (nickname) => {
  const q = `
    DELETE FROM usuario
    WHERE LOWER(nickname) = LOWER($1)
    RETURNING id, nickname
  `;
  const { rows } = await pool.query(q, [nickname]);
  return rows[0] || null;
};

// Inserta la relación de seguimiento con el estado indicado ('aceptado' para
// cuentas públicas, 'pendiente' para solicitudes a cuentas privadas). Devuelve
// la fila si fue un alta nueva, o null si ya existía (re-follow idempotente).
const followUser = async (seguidorId, seguidoId, estado = 'aceptado') => {
  const q = `
    INSERT INTO usuario_seguidor (seguidor_id, seguido_id, estado)
    VALUES ($1, $2, $3)
    ON CONFLICT DO NOTHING
    RETURNING seguidor_id, seguido_id, estado
  `;
  const { rows } = await pool.query(q, [seguidorId, seguidoId, estado]);
  return rows[0] || null;
};

const unfollowUser = async (seguidorId, seguidoId) => {
  const q = `
    DELETE FROM usuario_seguidor
    WHERE seguidor_id = $1 AND seguido_id = $2
    RETURNING seguidor_id, seguido_id
  `;
  const { rows } = await pool.query(q, [seguidorId, seguidoId]);
  return rows[0] || null;
};

// isFollowing = seguimiento efectivo (aceptado). Las solicitudes pendientes no
// cuentan como "ya lo sigo".
const isFollowing = async (seguidorId, seguidoId) => {
  const q = `
    SELECT 1 FROM usuario_seguidor
    WHERE seguidor_id = $1 AND seguido_id = $2 AND estado = 'aceptado'
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [seguidorId, seguidoId]);
  return rows.length > 0;
};

// Estado del seguimiento de seguidorId → seguidoId: 'aceptado', 'pendiente' o
// null si no existe relación. Sirve para que el botón de seguir muestre
// "Siguiendo" / "Solicitado" / "Seguir".
const getFollowState = async (seguidorId, seguidoId) => {
  const q = `
    SELECT estado FROM usuario_seguidor
    WHERE seguidor_id = $1 AND seguido_id = $2
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [seguidorId, seguidoId]);
  return rows[0]?.estado || null;
};

// Aceptar una solicitud pendiente: pasa la fila a 'aceptado'. Devuelve la fila
// si había una solicitud pendiente, o null si no (ya aceptada / cancelada).
const acceptFollowRequest = async (seguidorId, seguidoId) => {
  const q = `
    UPDATE usuario_seguidor
    SET estado = 'aceptado'
    WHERE seguidor_id = $1 AND seguido_id = $2 AND estado = 'pendiente'
    RETURNING seguidor_id, seguido_id
  `;
  const { rows } = await pool.query(q, [seguidorId, seguidoId]);
  return rows[0] || null;
};

// Rechazar una solicitud pendiente: elimina la fila. Devuelve la fila si había
// una solicitud pendiente, o null si no.
const rejectFollowRequest = async (seguidorId, seguidoId) => {
  const q = `
    DELETE FROM usuario_seguidor
    WHERE seguidor_id = $1 AND seguido_id = $2 AND estado = 'pendiente'
    RETURNING seguidor_id, seguido_id
  `;
  const { rows } = await pool.query(q, [seguidorId, seguidoId]);
  return rows[0] || null;
};

// Acepta en bloque todas las solicitudes pendientes hacia seguidoId. Se usa
// cuando una cuenta pasa de privada a pública: las solicitudes en espera se
// vuelven seguimientos efectivos. Devuelve cuántas filas se convirtieron.
const acceptAllPendingFollowRequests = async (seguidoId) => {
  const q = `
    UPDATE usuario_seguidor
    SET estado = 'aceptado'
    WHERE seguido_id = $1 AND estado = 'pendiente'
  `;
  const { rowCount } = await pool.query(q, [seguidoId]);
  return rowCount;
};

const searchUsers = async (query, viewerId = null) => {
  const q = `
    SELECT id, nickname, nombre, url_imagen
    FROM usuario
    WHERE estado = 'activo'
      AND (nickname ILIKE $1 OR nombre ILIKE $1)
      ${viewerId ? `AND id NOT IN (
        SELECT bloqueado_id FROM bloqueo WHERE bloqueador_id = $3
        UNION
        SELECT bloqueador_id FROM bloqueo WHERE bloqueado_id = $3
      )` : ''}
    ORDER BY
      CASE WHEN nickname ILIKE $2 THEN 0 ELSE 1 END,
      nickname ASC
    LIMIT 5
  `;
  const params = [`%${query}%`, `${query}%`];
  if (viewerId) params.push(viewerId);
  const { rows } = await pool.query(q, params);
  return rows;
};

const updateBannerById = async (id, url_banner) => {
  const q = `
    UPDATE usuario SET url_banner = $1
    WHERE id = $2
    RETURNING id, url_banner
  `;
  const { rows } = await pool.query(q, [url_banner, id]);
  return rows[0] || null;
};

const deleteBannerById = async (id) => {
  const q = `
    UPDATE usuario SET url_banner = NULL
    WHERE id = $1
    RETURNING id
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
};

const deleteAvatarById = async (id) => {
  const q = `
    UPDATE usuario SET url_imagen = NULL
    WHERE id = $1
    RETURNING id
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
};

const getSuggestedUsers = async (userId, limit = 10) => {
  const q = `
    SELECT u.id, u.nickname, u.nombre, u.url_imagen,
      (SELECT COUNT(*) FROM contenido c WHERE c.autor_id = u.id) AS actividad
    FROM usuario u
    WHERE u.estado = 'activo'
      AND u.id != $1
      AND u.id NOT IN (
        SELECT us.seguido_id FROM usuario_seguidor us WHERE us.seguidor_id = $1
      )
      AND u.id NOT IN (
        SELECT bloqueado_id FROM bloqueo WHERE bloqueador_id = $1
        UNION
        SELECT bloqueador_id FROM bloqueo WHERE bloqueado_id = $1
      )
    ORDER BY actividad DESC, u.fecha_creacion DESC
    LIMIT $2
  `;
  const { rows } = await pool.query(q, [userId, limit]);
  return rows;
};

const getMostActiveUsers = async (limit = 5) => {
  const q = `
    SELECT u.id, u.nickname, u.nombre, u.url_imagen,
      (
        SELECT COUNT(*) FROM tema t 
        JOIN contenido c ON c.id = t.contenido_id 
        WHERE c.autor_id = u.id AND t.estado = 'activo'
      ) + (
        SELECT COUNT(*) FROM comentario com 
        JOIN contenido c ON c.id = com.contenido_id 
        WHERE c.autor_id = u.id AND com.estado = 'visible'
      ) AS aportes
    FROM usuario u
    WHERE u.estado = 'activo'
    ORDER BY aportes DESC
    LIMIT $1
  `;
  const { rows } = await pool.query(q, [limit]);
  return rows;
};

const getPasswordHashById = async (id) => {
  const q = `
    SELECT password_hash
    FROM usuario
    WHERE id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0]?.password_hash || null;
};

const updatePasswordHashById = async (id, passwordHash) => {
  const q = `
    UPDATE usuario
    SET password_hash = $1
    WHERE id = $2
    RETURNING id
  `;
  const { rows } = await pool.query(q, [passwordHash, id]);
  return rows[0] || null;
};

const deactivateUser = async (userId) => {
  const q = `
    UPDATE usuario
    SET estado = 'inactivo',
        url_imagen = NULL,
        url_banner = NULL,
        biografia = NULL
    WHERE id = $1
    RETURNING id, nickname
  `;
  const { rows } = await pool.query(q, [userId]);
  return rows[0] || null;
};

const clearFollows = async (userId) => {
  await pool.query(`DELETE FROM usuario_seguidor WHERE seguidor_id = $1 OR seguido_id = $1`, [userId]);
};

const updatePrivacy = async (id, privado) => {
  const q = `
    UPDATE usuario SET privado = $1
    WHERE id = $2
    RETURNING id, privado
  `;
  const { rows } = await pool.query(q, [privado, id]);
  return rows[0] || null;
};

const getPrivacyById = async (id) => {
  const q = `SELECT privado FROM usuario WHERE id = $1`;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
};

const updateLikesPrivacy = async (id, value) => {
  const q = `
    UPDATE usuario SET me_gusta_privado = $1
    WHERE id = $2
    RETURNING id, me_gusta_privado
  `;
  const { rows } = await pool.query(q, [value, id]);
  return rows[0] || null;
};

const getLikesPrivacyById = async (id) => {
  const q = `SELECT me_gusta_privado FROM usuario WHERE id = $1`;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
};

export { findByEmailOrNickname, createUser, findByEmailOrNicknameForLogin, getUsers, 
  getUserByNickname, getUserIdByNickname, getCategoriesByUserId, getFollowersByUserId, 
  getFollowingByUserId, updateUserById, getUserAvatarUrlById, updateUserEstado, updateUserEstadoById,
  deleteUserByNickname, followUser, unfollowUser, isFollowing, getFollowState,
  acceptFollowRequest, rejectFollowRequest, acceptAllPendingFollowRequests, updateAvatarById,
  searchUsers, updateBannerById, deleteBannerById, deleteAvatarById, getSuggestedUsers,
  getMostActiveUsers, getPasswordHashById, updatePasswordHashById, deactivateUser, clearFollows, updatePrivacy, getPrivacyById,
  updateLikesPrivacy, getLikesPrivacyById };