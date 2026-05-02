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
    SELECT id, nickname, nombre, email, password_hash, biografia, url_imagen, estado
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
    SELECT id, nickname, email
    FROM usuario
    ORDER BY id ASC
  `;
  const { rows } = await pool.query(q);
  return rows;
};

const getUserByNickname = async (nickname) => {
  const q = `
    SELECT id, rol, nickname, nombre, email, biografia, url_imagen, url_banner, fecha_creacion
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
    SELECT c.id, c.titulo, c.descripcion, c.fecha_creacion,
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
    WHERE us.seguido_id = $1
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
    WHERE us.seguidor_id = $1
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

const deleteUserByNickname = async (nickname) => {
  const q = `
    DELETE FROM usuario
    WHERE LOWER(nickname) = LOWER($1)
    RETURNING id, nickname
  `;
  const { rows } = await pool.query(q, [nickname]);
  return rows[0] || null;
};

const followUser = async (seguidorId, seguidoId) => {
  const q = `
    INSERT INTO usuario_seguidor (seguidor_id, seguido_id)
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING
    RETURNING seguidor_id, seguido_id
  `;
  const { rows } = await pool.query(q, [seguidorId, seguidoId]);
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

const isFollowing = async (seguidorId, seguidoId) => {
  const q = `
    SELECT 1 FROM usuario_seguidor
    WHERE seguidor_id = $1 AND seguido_id = $2
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [seguidorId, seguidoId]);
  return rows.length > 0;
};

const searchUsers = async (query) => {
  const q = `
    SELECT id, nickname, nombre, url_imagen
    FROM usuario
    WHERE estado = 'activo'
      AND (nickname ILIKE $1 OR nombre ILIKE $1)
    ORDER BY 
      CASE WHEN nickname ILIKE $2 THEN 0 ELSE 1 END,
      nickname ASC
    LIMIT 5
  `;
  const { rows } = await pool.query(q, [`%${query}%`, `${query}%`]);
  return rows;
};

const getUserBannerUrlById = async (id) => {
  const q = `
    SELECT url_banner
    FROM usuario
    WHERE id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [id]);
  if (rows.length === 0) return undefined;
  return rows[0].url_banner;
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

export { findByEmailOrNickname, createUser, findByEmailOrNicknameForLogin, getUsers, 
  getUserByNickname, getUserIdByNickname, getCategoriesByUserId, getFollowersByUserId, 
  getFollowingByUserId, updateUserById, getUserAvatarUrlById, updateUserEstado, 
  deleteUserByNickname, followUser, unfollowUser, isFollowing, updateAvatarById, 
  searchUsers, getUserBannerUrlById, updateBannerById, deleteBannerById, deleteAvatarById };