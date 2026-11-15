import pool from '../config/db.js';
import { escapeLike } from '../utils/escapeLike.js';
import { encuestaSubquery } from './encuesta.repository.js';

// Cuatro secciones independientes: cada una se ordena y pagina sola.
// El match es strpos sobre texto sin tildes, nunca regex sobre el input: es literal y no puede fallar.
// Todo ORDER BY termina en id DESC para que la paginación con OFFSET sea estable.
// hasMore se resuelve pidiendo LIMIT + 1.

// Ventana del fragmento (snippet) alrededor del match, en caracteres.
const SNIP_BEFORE = 40;
const SNIP_AFTER = 80;

// Parte el fragmento en tres campos de texto plano (antes, match, después) para resaltarlo sin HTML.
// El corte se hace en SQL sobre el texto original: los índices de strpos no coinciden con
// los de JS (UTF-16) ni con el largo tras unaccent.
// `col` es un identificador fijo del call site, nunca input del usuario.
const snippetJoins = (col) => `
  LEFT JOIN LATERAL (
    SELECT strpos(unaccent(lower(${col})), unaccent(lower($1))) AS pos
  ) sp ON true
  LEFT JOIN LATERAL (
    SELECT
      CASE WHEN sp.pos > 0 THEN
        (CASE WHEN sp.pos > ${SNIP_BEFORE + 1} THEN '…' ELSE '' END)
        || substring(${col} FROM GREATEST(1, sp.pos - ${SNIP_BEFORE})
                            FOR sp.pos - GREATEST(1, sp.pos - ${SNIP_BEFORE}))
      END AS snippet_before,
      CASE WHEN sp.pos > 0 THEN substring(${col} FROM sp.pos FOR char_length($1)) END AS snippet_match,
      CASE WHEN sp.pos > 0 THEN
        substring(${col} FROM sp.pos + char_length($1) FOR ${SNIP_AFTER})
        || (CASE WHEN char_length(${col}) > sp.pos + char_length($1) - 1 + ${SNIP_AFTER} THEN '…' ELSE '' END)
      END AS snippet_after
  ) sn ON true`;

// Match en título primero. Solo categorías activas de autores activos.
const searchCategorias = async ({ term, etiqueta, limit, offset = 0 }) => {
  const q = `
    SELECT
      b.id, b.titulo, b.descripcion, b.icono, b.contador_temas, b.autor_nickname, b.etiquetas,
      sn.snippet_before, sn.snippet_match, sn.snippet_after
    FROM (
      SELECT c.id, c.titulo, c.descripcion, c.icono, c.contador_temas,
             u.nickname AS autor_nickname,
             ARRAY_AGG(e.nombre) FILTER (WHERE e.nombre IS NOT NULL) AS etiquetas,
             CASE WHEN strpos(unaccent(lower(c.titulo)), unaccent(lower($1))) > 0 THEN 0 ELSE 1 END AS title_rank
      FROM categoria c
      JOIN usuario u ON u.id = c.autor_id AND u.estado = 'activo'
      LEFT JOIN categoria_etiqueta ce ON ce.categoria_id = c.id
      LEFT JOIN etiqueta e ON e.id = ce.etiqueta_id
      WHERE c.estado = 'activa'
        AND (
          strpos(unaccent(lower(c.titulo)), unaccent(lower($1))) > 0
          OR strpos(unaccent(lower(c.descripcion)), unaccent(lower($1))) > 0
          OR EXISTS (
            SELECT 1 FROM categoria_etiqueta ce2
            JOIN etiqueta e2 ON e2.id = ce2.etiqueta_id
            WHERE ce2.categoria_id = c.id
              AND unaccent(lower(e2.nombre)) = unaccent(lower($1))
          )
        )
        AND ($2 = '' OR EXISTS (
          SELECT 1 FROM categoria_etiqueta cef
          JOIN etiqueta ef ON ef.id = cef.etiqueta_id
          WHERE cef.categoria_id = c.id
            AND unaccent(lower(ef.nombre)) = unaccent(lower($2))
        ))
      GROUP BY c.id, c.titulo, c.descripcion, c.icono, c.contador_temas, u.nickname
    ) b
    ${snippetJoins('b.descripcion')}
    ORDER BY b.title_rank, b.id DESC
    LIMIT $3 OFFSET $4
  `;
  const { rows } = await pool.query(q, [term, etiqueta, limit, offset]);
  return rows;
};

// El conteo que ordena es una subquery escalar: un tema sin comentarios visibles
// sigue apareciendo, con 0.
const searchTemas = async ({ term, etiqueta, limit, offset = 0 }) => {
  const q = `
    SELECT
      b.id, b.titulo, b.categoria_id, b.categoria_titulo, b.autor_nickname, b.contador_comentarios,
      sn.snippet_before, sn.snippet_match, sn.snippet_after
    FROM (
      SELECT t.contenido_id AS id, t.titulo, con.cuerpo,
             cat.id AS categoria_id, cat.titulo AS categoria_titulo,
             u.nickname AS autor_nickname,
             (SELECT COUNT(*)
                FROM comentario cm
                JOIN contenido cn ON cn.id = cm.contenido_id
                JOIN usuario ua ON ua.id = cn.autor_id AND ua.estado = 'activo'
              WHERE cm.tema_id = t.contenido_id
                AND cm.estado = 'visible'
                AND cm.motivo_inactivacion IS NULL) AS contador_comentarios
      FROM tema t
      JOIN contenido con ON con.id = t.contenido_id
      JOIN usuario u ON u.id = con.autor_id AND u.estado = 'activo'
      JOIN categoria cat ON cat.id = t.categoria_id AND cat.estado = 'activa'
      WHERE t.estado = 'activo'
        AND (
          strpos(unaccent(lower(t.titulo)), unaccent(lower($1))) > 0
          OR strpos(unaccent(lower(con.cuerpo)), unaccent(lower($1))) > 0
        )
        AND ($2 = '' OR EXISTS (
          SELECT 1 FROM categoria_etiqueta cef
          JOIN etiqueta ef ON ef.id = cef.etiqueta_id
          WHERE cef.categoria_id = cat.id
            AND unaccent(lower(ef.nombre)) = unaccent(lower($2))
        ))
    ) b
    ${snippetJoins('b.cuerpo')}
    ORDER BY b.contador_comentarios DESC, b.id DESC
    LIMIT $3 OFFSET $4
  `;
  const { rows } = await pool.query(q, [term, etiqueta, limit, offset]);
  return rows;
};

// Solo comentarios de primer nivel. El conjunto buscable y sus filtros de visibilidad
// viven en un único CTE. Con etiqueta se excluyen los comentarios de Home, que no
// pertenecen a ninguna categoría.
const searchComentarios = async ({ term, etiqueta, limit, offset = 0, viewerId = null }) => {
  const q = `
    WITH comentarios_buscables AS (
      -- Alias 'com' (no 'cm'): encuestaSubquery referencia com.contenido_id.
      SELECT com.contenido_id AS id, com.estado, com.motivo_inactivacion,
             con.cuerpo, con.fecha_creacion, con.autor_id,
             u.nickname AS autor_nickname, u.url_imagen AS autor_url_imagen, u.estado AS autor_estado,
             CASE WHEN com.es_home THEN 'home'
                  WHEN com.tema_id IS NOT NULL THEN 'tema'
                  ELSE 'categoria' END AS tipo,
             com.es_home, com.comentario_padre_id,
             COALESCE(com.tema_id, com.categoria_id) AS destino_id,
             COALESCE(t_dest.titulo, cat_dest.titulo) AS destino_titulo,
             t_dest.estado AS tema_estado,
             CASE WHEN com.tema_id IS NOT NULL THEN tc.estado
                  WHEN com.categoria_id IS NOT NULL THEN cat_dest.estado
                  ELSE NULL END AS categoria_estado,
             (SELECT COUNT(*) FROM comentario child
               WHERE child.comentario_padre_id = com.contenido_id AND child.estado = 'visible') AS contador_respuestas,
             (SELECT COUNT(*) FROM reaccion r
               WHERE r.contenido_id = com.contenido_id AND r.tipo = 'meGusta') AS likes,
             (SELECT tipo FROM reaccion WHERE contenido_id = com.contenido_id AND usuario_id = $5 LIMIT 1) AS mi_reaccion,
             (SELECT COALESCE(json_agg(json_build_object('id', a.id, 'url', a.url, 'nombre_original', a.nombre_original, 'tipo', a.tipo, 'tamano', a.tamano, 'estado', a.estado) ORDER BY a.id), '[]'::json)
                FROM adjunto a WHERE a.contenido_id = com.contenido_id) AS adjuntos,
             ${encuestaSubquery('$5')} AS encuesta
      FROM comentario com
      JOIN contenido con ON con.id = com.contenido_id
      JOIN usuario u ON u.id = con.autor_id AND u.estado = 'activo'
      LEFT JOIN tema t_dest ON t_dest.contenido_id = com.tema_id
      LEFT JOIN categoria tc ON tc.id = t_dest.categoria_id
      LEFT JOIN categoria cat_dest ON cat_dest.id = com.categoria_id
      WHERE com.comentario_padre_id IS NULL
        AND com.estado = 'visible'
        AND com.motivo_inactivacion IS NULL
        AND strpos(unaccent(lower(con.cuerpo)), unaccent(lower($1))) > 0
        AND (
          com.es_home
          OR (com.tema_id IS NOT NULL
              AND t_dest.estado = 'activo'
              AND EXISTS (SELECT 1 FROM categoria c2
                          WHERE c2.id = t_dest.categoria_id AND c2.estado = 'activa'))
          OR (com.categoria_id IS NOT NULL AND cat_dest.estado = 'activa')
        )
        AND ($2 = '' OR (
          NOT com.es_home
          AND EXISTS (
            SELECT 1 FROM categoria_etiqueta cef
            JOIN etiqueta ef ON ef.id = cef.etiqueta_id
            WHERE cef.categoria_id = COALESCE(com.categoria_id, t_dest.categoria_id)
              AND unaccent(lower(ef.nombre)) = unaccent(lower($2))
          )
        ))
    )
    SELECT cb.id, cb.estado, cb.motivo_inactivacion, cb.cuerpo, cb.fecha_creacion, cb.autor_id,
           cb.autor_nickname, cb.autor_url_imagen, cb.autor_estado,
           cb.tipo, cb.es_home, cb.comentario_padre_id,
           cb.destino_id, cb.destino_titulo, cb.tema_estado, cb.categoria_estado,
           cb.contador_respuestas, cb.likes, cb.mi_reaccion, cb.adjuntos, cb.encuesta,
           sn.snippet_before, sn.snippet_match, sn.snippet_after
    FROM comentarios_buscables cb
    ${snippetJoins('cb.cuerpo')}
    ORDER BY cb.likes DESC, cb.fecha_creacion DESC, cb.id DESC
    LIMIT $3 OFFSET $4
  `;
  const { rows } = await pool.query(q, [term, etiqueta, limit, offset, viewerId]);
  return rows;
};

// Prefijo de nickname primero. Excluye bloqueados en ambos sentidos respecto del viewer.
const searchUsuarios = async ({ term, viewerId = null, limit, offset = 0 }) => {
  const like = escapeLike(term);
  // $1 substring, $2 prefijo (ranking), $3 limit, $4 offset, [$5 viewerId]
  const params = [`%${like}%`, `${like}%`, limit, offset];
  let blockClause = '';
  if (viewerId) {
    params.push(viewerId);
    blockClause = `AND id NOT IN (
      SELECT bloqueado_id FROM bloqueo WHERE bloqueador_id = $${params.length}
      UNION
      SELECT bloqueador_id FROM bloqueo WHERE bloqueado_id = $${params.length}
    )`;
  }
  const q = `
    SELECT id, nickname, nombre, url_imagen
    FROM usuario
    WHERE estado = 'activo'
      AND (nickname ILIKE $1 ESCAPE '\\' OR nombre ILIKE $1 ESCAPE '\\')
      ${blockClause}
    ORDER BY
      CASE WHEN nickname ILIKE $2 ESCAPE '\\' THEN 0 ELSE 1 END,
      nickname ASC,
      id DESC
    LIMIT $3 OFFSET $4
  `;
  const { rows } = await pool.query(q, params);
  return rows;
};

export { searchCategorias, searchTemas, searchComentarios, searchUsuarios };
