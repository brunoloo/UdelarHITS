import pool from '../config/db.js';
import { escapeLike } from '../utils/escapeLike.js';

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
    SELECT id, nickname, nombre, email, password_hash, biografia, url_imagen, estado, rol, auth_provider, privado, me_gusta_privado, nickname_confirmado
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

const findByEmailForGoogleAuth = async (email) => {
  const q = `
    SELECT id, rol, nickname, nombre, email, biografia, url_imagen, estado, auth_provider, nickname_confirmado
    FROM usuario
    WHERE LOWER(email) = LOWER($1)
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [email]);
  return rows[0] || null;
};

const isNicknameTaken = async (nickname) => {
  const q = `SELECT 1 FROM usuario WHERE LOWER(nickname) = LOWER($1) LIMIT 1`;
  const { rows } = await pool.query(q, [nickname]);
  return rows.length > 0;
};

const createGoogleUser = async ({ nickname, nombre, email }) => {
  const q = `
    INSERT INTO usuario (nickname, nombre, email, password_hash, rol, estado, auth_provider, nickname_confirmado)
    VALUES ($1, $2, $3, NULL, 'user', 'activo', 'google', FALSE)
    RETURNING id, rol, nickname, nombre, email, biografia, url_imagen, estado, auth_provider, nickname_confirmado
  `;
  const { rows } = await pool.query(q, [nickname, nombre, email]);
  return rows[0];
};

const confirmNickname = async (userId, nickname) => {
  const q = `
    UPDATE usuario SET nickname = $2, nickname_confirmado = TRUE
    WHERE id = $1
    RETURNING id, rol, nickname, nombre, email, biografia, url_imagen, estado, auth_provider, nickname_confirmado
  `;
  const { rows } = await pool.query(q, [userId, nickname]);
  return rows[0] || null;
};

const createUser = async ({ nickname, nombre, email, passwordHash, rol = 'user', facultad = null }) => {
  const q = `
    INSERT INTO usuario (nickname, nombre, email, password_hash, rol, facultad)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, nickname, nombre, email, rol, facultad
  `;
  const { rows } = await pool.query(q, [nickname, nombre, email, passwordHash, rol, facultad]);
  return rows[0];
};

const getUsers = async () => {
  const q = `
    SELECT id, nickname, nombre, email, rol, url_imagen, estado, fecha_creacion, fecha_ultimo_acceso, auth_provider
    FROM usuario
    ORDER BY id ASC
  `;
  const { rows } = await pool.query(q);
  return rows;
};

// A lo sumo una escritura por hora y por usuario.
const touchLastAccessById = async (userId) => {
  const q = `
    UPDATE usuario
    SET fecha_ultimo_acceso = NOW()
    WHERE id = $1
      AND (fecha_ultimo_acceso IS NULL OR fecha_ultimo_acceso < NOW() - INTERVAL '1 hour')
  `;
  await pool.query(q, [userId]);
};

const getUserByNickname = async (nickname) => {
  const q = `
    SELECT u.id, u.rol, u.nickname, u.nombre, u.email, u.biografia, u.facultad, u.url_imagen, u.url_banner,
           u.fecha_creacion, u.estado, u.privado, u.me_gusta_privado, u.nickname_confirmado,
           u.auth_provider, (u.password_hash IS NOT NULL) AS tiene_password,
           ef.nombre_display AS facultad_display
    FROM usuario u
    -- La facultad se guarda como abreviatura sin FK (ver schema.sql); este JOIN
    -- sólo resuelve el nombre completo para mostrarlo en el perfil.
    LEFT JOIN etiqueta ef ON ef.grupo = 'Facultades' AND LOWER(ef.nombre) = LOWER(u.facultad)
    WHERE LOWER(u.nickname) = LOWER($1)
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [nickname]);
  return rows[0] || null;
};

const getUserById = async (id) => {
  const q = `
    SELECT u.id, u.rol, u.nickname, u.nombre, u.email, u.biografia, u.facultad, u.url_imagen, u.url_banner,
           u.fecha_creacion, u.estado, u.privado, u.me_gusta_privado, u.push_activado, u.nickname_confirmado,
           u.auth_provider, (u.password_hash IS NOT NULL) AS tiene_password,
           ef.nombre_display AS facultad_display
    FROM usuario u
    LEFT JOIN etiqueta ef ON ef.grupo = 'Facultades' AND LOWER(ef.nombre) = LOWER(u.facultad)
    WHERE u.id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [id]);
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
      ARRAY_AGG(e.nombre) AS etiquetas
    FROM categoria c
    LEFT JOIN categoria_etiqueta ce ON ce.categoria_id = c.id
    LEFT JOIN etiqueta e ON e.id = ce.etiqueta_id
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

const updateUserById = async (id, { nombre, biografia, facultad }) => {
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
  // null limpia el campo.
  if (facultad !== undefined) {
    fields.push(`facultad = $${idx++}`);
    values.push(facultad);
  }

  if (fields.length === 0) return null;

  values.push(id);
  const q = `
    UPDATE usuario
    SET ${fields.join(', ')}
    WHERE id = $${idx}
    RETURNING id, nickname, nombre, email, biografia, facultad, url_imagen
  `;
  const { rows } = await pool.query(q, values);
  return rows[0] || null;
};

// Sin distinguir mayúsculas; devuelve el nombre canónico del catálogo.
const findFacultadByNombre = async (nombre) => {
  const q = `
    SELECT nombre, nombre_display
    FROM etiqueta
    WHERE grupo = 'Facultades' AND LOWER(nombre) = LOWER($1)
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [nombre]);
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

// Devuelve null si la relación ya existía.
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

// Las solicitudes pendientes no cuentan como seguimiento.
const isFollowing = async (seguidorId, seguidoId) => {
  const q = `
    SELECT 1 FROM usuario_seguidor
    WHERE seguidor_id = $1 AND seguido_id = $2 AND estado = 'aceptado'
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [seguidorId, seguidoId]);
  return rows.length > 0;
};

// 'aceptado', 'pendiente' o null si no hay relación.
const getFollowState = async (seguidorId, seguidoId) => {
  const q = `
    SELECT estado FROM usuario_seguidor
    WHERE seguidor_id = $1 AND seguido_id = $2
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [seguidorId, seguidoId]);
  return rows[0]?.estado || null;
};

// Devuelve null si no había una solicitud pendiente.
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

// Devuelve null si no había una solicitud pendiente.
const rejectFollowRequest = async (seguidorId, seguidoId) => {
  const q = `
    DELETE FROM usuario_seguidor
    WHERE seguidor_id = $1 AND seguido_id = $2 AND estado = 'pendiente'
    RETURNING seguidor_id, seguido_id
  `;
  const { rows } = await pool.query(q, [seguidorId, seguidoId]);
  return rows[0] || null;
};

// Se usa cuando una cuenta pasa de privada a pública.
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
      AND (nickname ILIKE $1 ESCAPE '\\' OR nombre ILIKE $1 ESCAPE '\\')
      ${viewerId ? `AND id NOT IN (
        SELECT bloqueado_id FROM bloqueo WHERE bloqueador_id = $3
        UNION
        SELECT bloqueador_id FROM bloqueo WHERE bloqueado_id = $3
      )` : ''}
    ORDER BY
      CASE WHEN nickname ILIKE $2 ESCAPE '\\' THEN 0 ELSE 1 END,
      nickname ASC
    LIMIT 5
  `;
  const like = escapeLike(query);
  const params = [`%${like}%`, `${like}%`];
  if (viewerId) params.push(viewerId);
  const { rows } = await pool.query(q, params);
  return rows;
};

// Solo por prefijo de nickname; con prefijo vacío devuelve usuarios al azar.
// Excluye al viewer y a los bloqueados en ambos sentidos.
const searchMentionCandidates = async (prefix, viewerId = null) => {
  const params = [];
  let prefixClause = '';
  let order = 'ORDER BY random()';
  if (prefix) {
    params.push(`${escapeLike(prefix)}%`);
    prefixClause = `AND nickname ILIKE $${params.length} ESCAPE '\\'`;
    order = 'ORDER BY lower(nickname) ASC';
  }
  let viewerClause = '';
  if (viewerId) {
    params.push(viewerId);
    const v = `$${params.length}`;
    viewerClause = `AND id <> ${v}
      AND id NOT IN (
        SELECT bloqueado_id FROM bloqueo WHERE bloqueador_id = ${v}
        UNION
        SELECT bloqueador_id FROM bloqueo WHERE bloqueado_id = ${v}
      )`;
  }
  const q = `
    SELECT id, nickname, nombre, url_imagen
    FROM usuario
    WHERE estado = 'activo'
      ${prefixClause}
      ${viewerClause}
    ${order}
    LIMIT 5
  `;
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

// Sin participación del usuario no hay afinidad: se sugieren los más activos que no sigue.
const getSuggestedUsersFallback = async (userId, limit) => {
  const q = `
    SELECT u.id, u.nickname, u.nombre, u.url_imagen,
      (SELECT COUNT(*) FROM contenido c WHERE c.autor_id = u.id) AS score
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
    ORDER BY score DESC, u.fecha_creacion DESC
    LIMIT $2
  `;
  const { rows } = await pool.query(q, [userId, limit]);
  return rows;
};

// Score por afinidad: +3 por categoría en común, +1 por etiqueta en común, +2 por seguidor
// mutuo, con un multiplicador según la última actividad (×1.5 a 7 días, ×1.2 a 30).
// Devuelve también candidatos con score 0 para que la sección no quede vacía.
const getSuggestedUsers = async (userId, limit = 10) => {
  const actividad = await pool.query(
    `SELECT 1
       FROM comentario com
       JOIN contenido con ON con.id = com.contenido_id
      WHERE con.autor_id = $1 AND com.estado = 'visible'
      LIMIT 1`,
    [userId]
  );
  if (actividad.rowCount === 0) {
    return getSuggestedUsersFallback(userId, limit);
  }

  const q = `
    WITH mis_categorias AS (
      -- Categorías donde participo (comentario visible), resolviendo la
      -- categoría por el campo directo o vía el tema comentado.
      SELECT DISTINCT COALESCE(com.categoria_id, t.categoria_id) AS categoria_id
      FROM comentario com
      JOIN contenido con ON con.id = com.contenido_id
      LEFT JOIN tema t ON t.contenido_id = com.tema_id
      WHERE con.autor_id = $1 AND com.estado = 'visible'
    ),
    mis_etiquetas AS (
      SELECT DISTINCT ce.etiqueta_id
      FROM categoria_etiqueta ce
      WHERE ce.categoria_id IN (SELECT categoria_id FROM mis_categorias)
    ),
    mis_seguidos AS (
      SELECT seguido_id FROM usuario_seguidor
      WHERE seguidor_id = $1 AND estado = 'aceptado'
    ),
    -- Exclusiones: a quiénes sigo (cualquier estado) y bloqueos en ambos sentidos.
    excluidos AS (
      SELECT seguido_id AS id FROM usuario_seguidor WHERE seguidor_id = $1
      UNION SELECT bloqueado_id FROM bloqueo WHERE bloqueador_id = $1
      UNION SELECT bloqueador_id FROM bloqueo WHERE bloqueado_id = $1
    ),
    candidatos AS (
      SELECT u.id, u.nickname, u.nombre, u.url_imagen
      FROM usuario u
      WHERE u.id <> $1
        AND u.estado = 'activo'
        AND u.id NOT IN (SELECT id FROM excluidos)
    ),
    -- Categoría efectiva de cada comentario visible de un candidato.
    cand_comentario_cat AS (
      SELECT con.autor_id AS usuario_id,
             COALESCE(com.categoria_id, t.categoria_id) AS categoria_id
      FROM comentario com
      JOIN contenido con ON con.id = com.contenido_id
      LEFT JOIN tema t ON t.contenido_id = com.tema_id
      WHERE com.estado = 'visible'
        AND con.autor_id IN (SELECT id FROM candidatos)
    ),
    score_categorias AS (
      SELECT usuario_id, COUNT(DISTINCT categoria_id) * 3 AS pts
      FROM cand_comentario_cat
      WHERE categoria_id IN (SELECT categoria_id FROM mis_categorias)
      GROUP BY usuario_id
    ),
    score_etiquetas AS (
      SELECT cc.usuario_id, COUNT(DISTINCT ce.etiqueta_id) AS pts
      FROM cand_comentario_cat cc
      JOIN categoria_etiqueta ce ON ce.categoria_id = cc.categoria_id
      WHERE ce.etiqueta_id IN (SELECT etiqueta_id FROM mis_etiquetas)
      GROUP BY cc.usuario_id
    ),
    score_social AS (
      SELECT s.seguido_id AS usuario_id, COUNT(*) * 2 AS pts
      FROM usuario_seguidor s
      WHERE s.seguidor_id IN (SELECT seguido_id FROM mis_seguidos)
        AND s.estado = 'aceptado'
        AND s.seguido_id IN (SELECT id FROM candidatos)
      GROUP BY s.seguido_id
    ),
    ultima_actividad AS (
      SELECT con.autor_id AS usuario_id, MAX(con.fecha_creacion) AS ultima
      FROM contenido con
      WHERE con.autor_id IN (SELECT id FROM candidatos)
      GROUP BY con.autor_id
    )
    SELECT ca.id, ca.nickname, ca.nombre, ca.url_imagen,
      (COALESCE(sc.pts, 0) + COALESCE(se.pts, 0) + COALESCE(ss.pts, 0))
      * CASE
          WHEN ua.ultima >= NOW() - INTERVAL '7 days'  THEN 1.5
          WHEN ua.ultima >= NOW() - INTERVAL '30 days' THEN 1.2
          ELSE 1.0
        END AS score
    FROM candidatos ca
    LEFT JOIN score_categorias sc ON sc.usuario_id = ca.id
    LEFT JOIN score_etiquetas  se ON se.usuario_id = ca.id
    LEFT JOIN score_social     ss ON ss.usuario_id = ca.id
    LEFT JOIN ultima_actividad ua ON ua.usuario_id = ca.id
    ORDER BY score DESC, ua.ultima DESC NULLS LAST
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

// Para invitados: usuarios activos al azar con al menos un aporte visible.
// ORDER BY RANDOM() recorre toda la tabla; aceptable al tamaño actual.
const getRandomActiveUsers = async (limit = 10) => {
  const q = `
    SELECT u.id, u.nickname, u.nombre, u.url_imagen
    FROM usuario u
    WHERE u.estado = 'activo'
      AND (
        EXISTS (
          SELECT 1 FROM tema t
          JOIN contenido c ON c.id = t.contenido_id
          WHERE c.autor_id = u.id AND t.estado = 'activo'
        )
        OR EXISTS (
          SELECT 1 FROM comentario com
          JOIN contenido c ON c.id = com.contenido_id
          WHERE c.autor_id = u.id AND com.estado = 'visible'
        )
      )
    ORDER BY RANDOM()
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

// Distingue cuenta inexistente (null) de cuenta sin contraseña (password_hash null).
const getAccountAuthById = async (id) => {
  const q = `
    SELECT id, nickname, email, auth_provider, password_hash
    FROM usuario
    WHERE id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
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

// Es la N de la rampa de intensidad del feed; el service la cachea.
const countActiveUsers = async () => {
  const { rows } = await pool.query(`SELECT COUNT(*)::int AS n FROM usuario WHERE estado = 'activo'`);
  return rows[0].n;
};

export { findByEmailOrNickname, createUser, findByEmailOrNicknameForLogin, getUsers,
  findByEmailForGoogleAuth, isNicknameTaken, createGoogleUser, confirmNickname,
  getUserByNickname, getUserById, getUserIdByNickname, getCategoriesByUserId, getFollowersByUserId,
  getFollowingByUserId, updateUserById, findFacultadByNombre, getUserAvatarUrlById, updateUserEstado, updateUserEstadoById,
  deleteUserByNickname, followUser, unfollowUser, isFollowing, getFollowState,
  acceptFollowRequest, rejectFollowRequest, acceptAllPendingFollowRequests, updateAvatarById,
  searchUsers, searchMentionCandidates, updateBannerById, deleteBannerById, deleteAvatarById, getSuggestedUsers,
  getMostActiveUsers, getRandomActiveUsers, getPasswordHashById, getAccountAuthById, updatePasswordHashById, deactivateUser, clearFollows, updatePrivacy, getPrivacyById,
  updateLikesPrivacy, getLikesPrivacyById, countActiveUsers, touchLastAccessById };