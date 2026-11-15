import pool from '../config/db.js';

// Objeto JSON de la encuesta de un comentario (alias `com`). `viewerParam` es el
// placeholder del usuario que mira.
export const encuestaSubquery = (viewerParam = 'NULL::bigint') => `(
  SELECT json_build_object(
    'id', e.id,
    'fecha_cierre', e.fecha_cierre,
    'cerrada', (e.fecha_cierre <= NOW()),
    'total_votos', (SELECT COUNT(*) FROM encuesta_voto v WHERE v.encuesta_id = e.id),
    'mi_voto', (SELECT v.opcion_id FROM encuesta_voto v WHERE v.encuesta_id = e.id AND v.usuario_id = ${viewerParam} LIMIT 1),
    'opciones', (
      SELECT COALESCE(json_agg(json_build_object(
        'id', o.id, 'texto', o.texto, 'orden', o.orden,
        'votos', (SELECT COUNT(*) FROM encuesta_voto v WHERE v.opcion_id = o.id)
      ) ORDER BY o.orden), '[]'::json)
      FROM encuesta_opcion o WHERE o.encuesta_id = e.id
    )
  )
  FROM encuesta e WHERE e.contenido_id = com.contenido_id
)`;

const createPoll = async ({ contenidoId, fechaCierre, opciones }) => {
  const { rows } = await pool.query(
    `INSERT INTO encuesta (contenido_id, fecha_cierre) VALUES ($1, $2) RETURNING id`,
    [contenidoId, fechaCierre]
  );
  const encuestaId = rows[0].id;
  for (let i = 0; i < opciones.length; i++) {
    await pool.query(
      `INSERT INTO encuesta_opcion (encuesta_id, texto, orden) VALUES ($1, $2, $3)`,
      [encuestaId, opciones[i], i + 1]
    );
  }
  return encuestaId;
};

const getPollById = async (encuestaId) => {
  const { rows } = await pool.query(
    `SELECT id, contenido_id, fecha_cierre, (fecha_cierre <= NOW()) AS cerrada
     FROM encuesta WHERE id = $1`,
    [encuestaId]
  );
  return rows[0] || null;
};

const getOption = async (opcionId) => {
  const { rows } = await pool.query(
    `SELECT id, encuesta_id FROM encuesta_opcion WHERE id = $1`,
    [opcionId]
  );
  return rows[0] || null;
};

// Devuelve false si el usuario ya había votado.
const castVote = async (encuestaId, opcionId, usuarioId) => {
  const { rowCount } = await pool.query(
    `INSERT INTO encuesta_voto (encuesta_id, opcion_id, usuario_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (encuesta_id, usuario_id) DO NOTHING`,
    [encuestaId, opcionId, usuarioId]
  );
  return rowCount > 0;
};

const getPollByContenidoId = async (contenidoId, viewerId = null) => {
  const { rows } = await pool.query(
    `SELECT json_build_object(
       'id', e.id,
       'fecha_cierre', e.fecha_cierre,
       'cerrada', (e.fecha_cierre <= NOW()),
       'total_votos', (SELECT COUNT(*) FROM encuesta_voto v WHERE v.encuesta_id = e.id),
       'mi_voto', (SELECT v.opcion_id FROM encuesta_voto v WHERE v.encuesta_id = e.id AND v.usuario_id = $2 LIMIT 1),
       'opciones', (
         SELECT COALESCE(json_agg(json_build_object(
           'id', o.id, 'texto', o.texto, 'orden', o.orden,
           'votos', (SELECT COUNT(*) FROM encuesta_voto v WHERE v.opcion_id = o.id)
         ) ORDER BY o.orden), '[]'::json)
         FROM encuesta_opcion o WHERE o.encuesta_id = e.id
       )
     ) AS encuesta
     FROM encuesta e WHERE e.contenido_id = $1`,
    [contenidoId, viewerId]
  );
  return rows[0]?.encuesta || null;
};

export { createPoll, getPollById, getOption, castVote, getPollByContenidoId };
