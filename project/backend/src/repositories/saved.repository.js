import pool from '../config/db.js';
import { encuestaSubquery } from './encuesta.repository.js';

// Guarda un item. Idempotente y valida que el id corresponda al tipo declarado.
const saveItem = async (usuarioId, tipo, id) => {
  if (tipo === 'categoria') {
    await pool.query(
      `INSERT INTO guardado (usuario_id, tipo, categoria_id)
       SELECT $1, 'categoria', $2
       WHERE EXISTS (SELECT 1 FROM categoria WHERE id = $2)
         AND NOT EXISTS (SELECT 1 FROM guardado WHERE usuario_id = $1 AND categoria_id = $2)`,
      [usuarioId, id]
    );
  } else {
    // tema o comentario: ambos referencian contenido_id. Validamos contra la
    // tabla correcta según el tipo.
    const tabla = tipo === 'tema' ? 'tema' : 'comentario';
    await pool.query(
      `INSERT INTO guardado (usuario_id, tipo, contenido_id)
       SELECT $1, $2, $3
       WHERE EXISTS (SELECT 1 FROM ${tabla} WHERE contenido_id = $3)
         AND NOT EXISTS (SELECT 1 FROM guardado WHERE usuario_id = $1 AND contenido_id = $3)`,
      [usuarioId, tipo, id]
    );
  }
};

const unsaveItem = async (usuarioId, tipo, id) => {
  if (tipo === 'categoria') {
    await pool.query(
      `DELETE FROM guardado WHERE usuario_id = $1 AND categoria_id = $2`,
      [usuarioId, id]
    );
  } else {
    await pool.query(
      `DELETE FROM guardado WHERE usuario_id = $1 AND contenido_id = $2 AND tipo = $3`,
      [usuarioId, id, tipo]
    );
  }
};

// Ids de todo lo guardado por el usuario (para marcar el ícono en cualquier vista).
const getSavedIds = async (usuarioId) => {
  const { rows } = await pool.query(
    `SELECT tipo, categoria_id, contenido_id FROM guardado WHERE usuario_id = $1`,
    [usuarioId]
  );
  return rows;
};

// ── Listado del panel (cada query trae la forma de la card correspondiente) ──

const getSavedCategorias = async (usuarioId) => {
  const q = `
    SELECT c.id, c.titulo, c.descripcion, c.icono, c.contador_temas,
      g.fecha_creacion AS fecha_guardado,
      ARRAY_AGG(e.nombre) AS etiquetas
    FROM guardado g
    JOIN categoria c ON c.id = g.categoria_id
    LEFT JOIN categoria_etiqueta ce ON ce.categoria_id = c.id
    LEFT JOIN etiqueta e ON e.id = ce.etiqueta_id
    WHERE g.usuario_id = $1 AND g.tipo = 'categoria' AND c.estado = 'activa'
    GROUP BY c.id, g.fecha_creacion
    ORDER BY g.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q, [usuarioId]);
  return rows;
};

const getSavedTemas = async (usuarioId) => {
  const q = `
    SELECT t.contenido_id AS id, t.titulo, t.categoria_id, con.cuerpo,
      CASE WHEN c.estado = 'inactiva' THEN NULL ELSE c.titulo END AS categoria_titulo,
      c.estado AS categoria_estado, g.fecha_creacion AS fecha_guardado,
      (SELECT COUNT(*) FROM comentario com
         WHERE com.tema_id = t.contenido_id AND com.estado = 'visible' AND com.comentario_padre_id IS NULL
      ) AS contador_comentarios
    FROM guardado g
    JOIN tema t ON t.contenido_id = g.contenido_id
    JOIN contenido con ON con.id = t.contenido_id
    JOIN categoria c ON c.id = t.categoria_id
    WHERE g.usuario_id = $1 AND g.tipo = 'tema' AND t.estado = 'activo'
    ORDER BY g.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q, [usuarioId]);
  return rows;
};

const getSavedComentarios = async (usuarioId) => {
  // Misma forma que getRepliesByUserId (CommentCard completa) + fecha_guardado.
  // El viewer es el propio dueño, así que $1 sirve para mi_reaccion.
  const q = `
    SELECT com.contenido_id AS id, com.estado, com.motivo_inactivacion,
      con.cuerpo, con.fecha_creacion, con.autor_id,
      u.nickname AS autor_nickname, u.url_imagen AS autor_url_imagen, u.estado AS autor_estado,
      CASE WHEN com.tema_id IS NOT NULL THEN 'tema' ELSE 'categoria' END AS tipo,
      COALESCE(
        CASE WHEN t.estado = 'inactivo' THEN NULL ELSE t.titulo END,
        CASE WHEN cat.estado = 'inactiva' THEN NULL ELSE cat.titulo END
      ) AS destino_titulo,
      COALESCE(com.tema_id, com.categoria_id) AS destino_id,
      CASE WHEN com.tema_id IS NOT NULL THEN tc.estado ELSE cat.estado END AS categoria_estado,
      t.estado AS tema_estado,
      com.comentario_padre_id,
      (SELECT u_p.nickname FROM contenido con_p JOIN usuario u_p ON u_p.id = con_p.autor_id WHERE con_p.id = com.comentario_padre_id) AS padre_autor_nickname,
      (SELECT u_p.estado FROM contenido con_p JOIN usuario u_p ON u_p.id = con_p.autor_id WHERE con_p.id = com.comentario_padre_id) AS padre_autor_estado,
      (SELECT COUNT(*) FROM comentario child WHERE child.comentario_padre_id = com.contenido_id AND child.estado = 'visible') AS contador_respuestas,
      (SELECT COUNT(*) FROM reaccion WHERE contenido_id = com.contenido_id AND tipo = 'meGusta') AS likes,
      (SELECT tipo FROM reaccion WHERE contenido_id = com.contenido_id AND usuario_id = $1 LIMIT 1) AS mi_reaccion,
      (SELECT COALESCE(json_agg(json_build_object('id', a.id, 'url', a.url, 'nombre_original', a.nombre_original, 'tipo', a.tipo, 'tamano', a.tamano) ORDER BY a.id), '[]'::json)
       FROM adjunto a WHERE a.contenido_id = com.contenido_id) AS adjuntos,
      ${encuestaSubquery('$1')} AS encuesta,
      g.fecha_creacion AS fecha_guardado
    FROM guardado g
    JOIN comentario com ON com.contenido_id = g.contenido_id
    JOIN contenido con ON con.id = com.contenido_id
    JOIN usuario u ON u.id = con.autor_id
    LEFT JOIN tema t ON t.contenido_id = com.tema_id
    LEFT JOIN categoria tc ON tc.id = t.categoria_id
    LEFT JOIN categoria cat ON cat.id = com.categoria_id
    WHERE g.usuario_id = $1 AND g.tipo = 'comentario'
    ORDER BY g.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q, [usuarioId]);
  return rows;
};

export { saveItem, unsaveItem, getSavedIds, getSavedCategorias, getSavedTemas, getSavedComentarios };
