import pool from '../config/db.js';
import { escapeLike } from '../utils/escapeLike.js';
import { encuestaSubquery } from './encuesta.repository.js';
import { TRENDING, halfLifeHours } from '../config/trendingConfig.js';
import { FEED } from '../config/feedConfig.js';

const { W_TEMA, W_COMENTARIO } = TRENDING;

const createCategory = async ({ titulo, descripcion, autor_id, etiquetas }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const q = `
      INSERT INTO categoria (titulo, descripcion, autor_id)
      VALUES ($1, $2, $3)
      RETURNING id, titulo, descripcion, autor_id, estado, fecha_creacion
    `;
    const { rows } = await client.query(q, [titulo, descripcion, autor_id]);
    const category = rows[0];

    for (const etiquetaId of etiquetas) {
      await client.query(
        `INSERT INTO categoria_etiqueta (categoria_id, etiqueta_id) VALUES ($1, $2)`,
        [category.id, etiquetaId]
      );
    }

    await client.query(`
      INSERT INTO participacion_categoria (usuario_id, categoria_id, rol)
      VALUES ($1, $2, 'moderador')
    `, [autor_id, category.id]);

    await client.query('COMMIT');
    return category;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const findCategoryByTitulo = async (titulo) => {
  const q = `SELECT id FROM categoria
  WHERE unaccent(LOWER(REGEXP_REPLACE(titulo, '\\s+', ' ', 'g'))) = unaccent(LOWER($1)) LIMIT 1`;
  const { rows } = await pool.query(q, [titulo]);
  return rows[0] || null;
};

const getCategories = async () => {
  const q = `
    SELECT c.id, c.titulo, c.descripcion, c.autor_id, u.nickname AS autor_nickname,
      c.estado, c.contador_temas, c.fecha_creacion, c.icono,
      ARRAY_AGG(e.nombre) AS etiquetas
    FROM categoria c
    LEFT JOIN categoria_etiqueta ce ON ce.categoria_id = c.id
    LEFT JOIN etiqueta e ON e.id = ce.etiqueta_id
    JOIN usuario u ON u.id = c.autor_id
    GROUP BY c.id, u.nickname
    ORDER BY c.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q);
  return rows;
};

const getCategoryById = async (id) => {
  const q = `
    SELECT c.id, c.titulo, c.descripcion, c.autor_id, c.estado, c.fecha_creacion, c.icono,
      COALESCE(c.fijada_hasta > NOW(), false) AS fijada, c.fijada_hasta,
      u.nickname AS autor_nickname, u.url_imagen AS autor_url_imagen, u.estado AS autor_estado, u.facultad AS autor_facultad,
      (SELECT COUNT(*) FROM tema t WHERE t.categoria_id = c.id AND t.estado = 'activo') AS contador_temas,
      ARRAY_AGG(e.nombre) AS etiquetas
    FROM categoria c
    JOIN usuario u ON u.id = c.autor_id
    LEFT JOIN categoria_etiqueta ce ON ce.categoria_id = c.id
    LEFT JOIN etiqueta e ON e.id = ce.etiqueta_id
    WHERE c.id = $1
    GROUP BY c.id, u.nickname, u.url_imagen, u.estado, u.facultad
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
};

const getCategoriesByAuthorId = async (autorId) => {
  const q = `
    SELECT c.id, c.titulo, c.descripcion, c.estado, c.fecha_creacion, c.icono,
      (SELECT COUNT(*) FROM tema t WHERE t.categoria_id = c.id AND t.estado = 'activo') AS contador_temas,
      ARRAY_AGG(e.nombre) AS etiquetas
    FROM categoria c
    LEFT JOIN categoria_etiqueta ce ON ce.categoria_id = c.id
    LEFT JOIN etiqueta e ON e.id = ce.etiqueta_id
    WHERE c.autor_id = $1
    GROUP BY c.id
    ORDER BY c.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q, [autorId]);
  return rows;
};

const getTopicsByCategoryId = async (categoryId) => {
  const q = `
    SELECT t.contenido_id, t.titulo, t.estado, c.fecha_creacion, c.autor_id, c.cuerpo,
      u.nickname AS autor_nickname, u.url_imagen AS autor_url_imagen, u.estado AS autor_estado, u.facultad AS autor_facultad,
      (SELECT COUNT(*) FROM comentario com
          WHERE com.tema_id = t.contenido_id
            AND com.estado = 'visible'
            AND com.comentario_padre_id IS NULL
        ) AS contador_comentarios,
      COALESCE(t.contenido_id = cat.tema_fijado_id, false) AS fijado
    FROM tema t
    JOIN contenido c ON c.id = t.contenido_id
    JOIN usuario u ON u.id = c.autor_id
    JOIN categoria cat ON cat.id = t.categoria_id
    WHERE t.categoria_id = $1 AND t.estado = 'activo'
    ORDER BY (t.contenido_id = cat.tema_fijado_id) DESC, c.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q, [categoryId]);
  return rows;
};

const deactivateCategoryById = async (id) => {
  const q = `
    UPDATE categoria
    SET estado = 'inactiva', titulo = titulo || '_deleted_' || id
    WHERE id = $1
    RETURNING id, titulo, estado
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
};

const activeCategoryById = async (id) => {
  const q = `
    UPDATE categoria
    SET estado = 'activa'
    WHERE id = $1
    RETURNING id, titulo, estado
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
};

const updateCategoryById = async (id, { descripcion, etiquetas, icono }, editorId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (icono !== undefined) {
      await client.query(
        `UPDATE categoria SET icono = $1 WHERE id = $2`,
        [icono, id]
      );
    }

    if (descripcion !== undefined) {
      const { rows: currentRows } = await client.query(
        `SELECT descripcion FROM categoria WHERE id = $1`,
        [id]
      );

      const currentDesc = currentRows[0]?.descripcion;

      // Solo se guarda historial si la descripción cambió.
      if (currentDesc != null && currentDesc !== descripcion) {
        await client.query(
          `INSERT INTO historial_edicion_categoria 
            (categoria_id, descripcion_anterior, descripcion_nueva, editor_id)
           VALUES ($1, $2, $3, $4)`,
          [id, currentDesc, descripcion, editorId]
        );
      }

      await client.query(
        `UPDATE categoria SET descripcion = $1 WHERE id = $2`,
        [descripcion, id]
      );
    }

    if (etiquetas !== undefined) {
      await client.query(
        `DELETE FROM categoria_etiqueta WHERE categoria_id = $1`,
        [id]
      );
      for (const etiquetaId of etiquetas) {
        await client.query(
          `INSERT INTO categoria_etiqueta (categoria_id, etiqueta_id) VALUES ($1, $2)`,
          [id, etiquetaId]
        );
      }
    }

    await client.query('COMMIT');

    const { rows } = await client.query(
      `SELECT c.id, c.titulo, c.descripcion, c.estado, c.icono,
        ARRAY_AGG(e.nombre) AS etiquetas
       FROM categoria c
       LEFT JOIN categoria_etiqueta ce ON ce.categoria_id = c.id
       LEFT JOIN etiqueta e ON e.id = ce.etiqueta_id
       WHERE c.id = $1
       GROUP BY c.id`,
      [id]
    );
    return rows[0] || null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const getCategoryEditHistory = async (categoryId) => {
  const q = `
    SELECT h.id, h.descripcion_anterior, h.descripcion_nueva,
      h.fecha_edicion, u.nickname AS editor_nickname
    FROM historial_edicion_categoria h
    JOIN usuario u ON u.id = h.editor_id
    WHERE h.categoria_id = $1
    ORDER BY h.fecha_edicion DESC
  `;
  const { rows } = await pool.query(q, [categoryId]);
  return rows;
};

const assignParticipantRole = async (userId, categoriaId) => {
  const q = `
    INSERT INTO participacion_categoria (usuario_id, categoria_id, rol)
    VALUES ($1, $2, 'participante')
    ON CONFLICT (usuario_id, categoria_id) DO NOTHING
  `;
  await pool.query(q, [userId, categoriaId]);
};

// Bloqueos en ambos sentidos entre el viewer y el autor. Solo interpola placeholders
// y columnas fijas, nunca valores.
const notBlockedSql = (viewerPh, autorCol) => `
          AND NOT EXISTS (
            SELECT 1 FROM bloqueo b
            WHERE (b.bloqueador_id = ${viewerPh}::bigint AND b.bloqueado_id = ${autorCol})
               OR (b.bloqueado_id = ${viewerPh}::bigint AND b.bloqueador_id = ${autorCol})
          )`;

// Fecha del último tema activo o comentario visible de la categoría (directo o de un
// tema); sin contenido, su fecha de creación.
const ULTIMA_ACTIVIDAD_SQL = `
      GREATEST(
        c.fecha_creacion,
        (SELECT MAX(con.fecha_creacion) FROM tema t
           JOIN contenido con ON con.id = t.contenido_id
          WHERE t.categoria_id = c.id AND t.estado = 'activo'),
        (SELECT MAX(con.fecha_creacion) FROM comentario com
           JOIN contenido con ON con.id = com.contenido_id
          WHERE com.categoria_id = c.id AND com.estado = 'visible'),
        (SELECT MAX(con.fecha_creacion) FROM comentario com
           JOIN contenido con ON con.id = com.contenido_id
           JOIN tema t ON t.contenido_id = com.tema_id
          WHERE t.categoria_id = c.id AND t.estado = 'activo' AND com.estado = 'visible')
      ) AS ultima_actividad,`;

// Card de una categoría activa, compartida por el listado y el feed. Con viewerPh,
// el último tema y el último comentario omiten autores bloqueados.
const categoryCardQuery = ({ viewerPh = null, idsFilter = null, conActividad = false } = {}) => `
    SELECT c.id, c.titulo, c.descripcion, c.contador_temas,
      c.fecha_creacion, c.icono, c.fijada_hasta, u.nickname AS autor_nickname, u.estado AS autor_estado, u.facultad AS autor_facultad,${conActividad ? ULTIMA_ACTIVIDAD_SQL : ''}
      -- Comentarios directos (top-level) de la categoría: mismo criterio que el
      -- tab "Comentarios" de la página (getRepliesByCategory), para que el número
      -- de la card coincida con el de la página.
      (SELECT COUNT(*) FROM comentario cc
         WHERE cc.categoria_id = c.id AND cc.comentario_padre_id IS NULL) AS contador_comentarios,
      ARRAY_AGG(e.nombre) AS etiquetas,
      (
        SELECT json_build_object(
          'titulo', t.titulo,
          'autor', u2.nickname,
          'fecha', con.fecha_creacion
        )
        FROM tema t
        JOIN contenido con ON con.id = t.contenido_id
        JOIN usuario u2 ON u2.id = con.autor_id
        WHERE t.categoria_id = c.id AND t.estado = 'activo'${viewerPh ? notBlockedSql(viewerPh, 'con.autor_id') : ''}
        ORDER BY con.fecha_creacion DESC
        LIMIT 1
      ) AS ultimo_tema,
      (
        -- Comentario que la categoría expone en su CategoryCard del Home: si hay
        -- uno fijado, ése (mayor peso); si no, el más reciente directo y visible.
        SELECT json_build_object(
          'id', com.contenido_id,
          'cuerpo', con2.cuerpo,
          'autor_nickname', u3.nickname,
          'autor_url_imagen', u3.url_imagen,
          'autor_estado', u3.estado,
          'autor_facultad', u3.facultad,
          'fecha_creacion', con2.fecha_creacion,
          'likes', (SELECT COUNT(*) FROM reaccion r WHERE r.contenido_id = com.contenido_id AND r.tipo = 'meGusta'),
          'contador_respuestas', (SELECT COUNT(*) FROM comentario child WHERE child.comentario_padre_id = com.contenido_id AND child.estado = 'visible'),
          'adjuntos', (
            SELECT COALESCE(json_agg(json_build_object('id', a.id, 'url', a.url, 'nombre_original', a.nombre_original, 'tipo', a.tipo, 'tamano', a.tamano) ORDER BY a.id), '[]'::json)
            FROM adjunto a WHERE a.contenido_id = com.contenido_id AND a.estado = 'publicado'
          ),
          'encuesta', ${encuestaSubquery('NULL::bigint')}
        )
        FROM comentario com
        JOIN contenido con2 ON con2.id = com.contenido_id
        JOIN usuario u3 ON u3.id = con2.autor_id
        WHERE com.categoria_id = c.id
          AND com.comentario_padre_id IS NULL
          AND com.estado = 'visible'${viewerPh ? notBlockedSql(viewerPh, 'con2.autor_id') : ''}
        ORDER BY COALESCE(com.contenido_id = c.comentario_fijado_id, false) DESC,
                 con2.fecha_creacion DESC
        LIMIT 1
      ) AS ultimo_comentario
    FROM categoria c
    JOIN usuario u ON u.id = c.autor_id
    LEFT JOIN categoria_etiqueta ce ON ce.categoria_id = c.id
    LEFT JOIN etiqueta e ON e.id = ce.etiqueta_id
    WHERE c.estado = 'activa'${idsFilter ? `
      AND c.id IN (${idsFilter})` : ''}
    GROUP BY c.id, u.nickname, u.estado, u.facultad
`;
const CATEGORY_CARD_QUERY = categoryCardQuery();

// `etiqueta` es igualdad exacta y `q` es substring del título o nombre de etiqueta;
// ambos sin distinguir tildes ni mayúsculas.
const getActiveCategories = async ({ q = null, etiqueta = null } = {}) => {
  const params = [];
  const conds = [];

  const etiquetaVal = etiqueta != null ? String(etiqueta).trim() : '';
  if (etiquetaVal !== '') {
    params.push(etiquetaVal);
    conds.push(`EXISTS (
      SELECT 1 FROM categoria_etiqueta ce
      JOIN etiqueta e ON e.id = ce.etiqueta_id
      WHERE ce.categoria_id = card.id
        AND unaccent(lower(e.nombre)) = unaccent(lower($${params.length}))
    )`);
  }

  const qVal = q != null ? String(q).trim() : '';
  if (qVal !== '') {
    params.push(qVal);
    const i = params.length;
    conds.push(`(
      strpos(unaccent(lower(card.titulo)), unaccent(lower($${i}))) > 0
      OR EXISTS (
        SELECT 1 FROM categoria_etiqueta ce2
        JOIN etiqueta e2 ON e2.id = ce2.etiqueta_id
        WHERE ce2.categoria_id = card.id
          AND unaccent(lower(e2.nombre)) = unaccent(lower($${i}))
      )
    )`);
  }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const query = `
    SELECT card.* FROM (${CATEGORY_CARD_QUERY}) card
    ${where}
    ORDER BY card.titulo DESC
  `;
  const { rows } = await pool.query(query, params);
  return rows;
};

// Sin último tema ni último comentario, que son el grueso del costo de la card.
const getCategoryIndex = async () => {
  const q = `
    SELECT c.id, c.titulo, c.descripcion, c.icono, c.contador_temas,
      c.fecha_creacion, u.nickname AS autor_nickname, u.estado AS autor_estado, u.facultad AS autor_facultad,
      -- Mismo criterio que la card y que el tab "Comentarios": directos (top-level).
      (SELECT COUNT(*) FROM comentario cc
         WHERE cc.categoria_id = c.id AND cc.comentario_padre_id IS NULL) AS contador_comentarios,
      ARRAY_AGG(e.nombre) AS etiquetas
    FROM categoria c
    JOIN usuario u ON u.id = c.autor_id
    LEFT JOIN categoria_etiqueta ce ON ce.categoria_id = c.id
    LEFT JOIN etiqueta e ON e.id = ce.etiqueta_id
    WHERE c.estado = 'activa'
    GROUP BY c.id, u.nickname, u.estado, u.facultad
    ORDER BY c.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q);
  return rows;
};

// Ordenado por última actividad: una categoría con conversación reciente va antes que
// una vacía creada después. Cursor compuesto (fecha, id) para no repetir ni saltar
// filas en empates de fecha.
const getChronoFeed = async ({ limit, cursorFecha = null, cursorId = null }) => {
  const q = `
    SELECT card.* FROM (${categoryCardQuery({ conActividad: true })}) card
    WHERE (card.fijada_hasta IS NULL OR card.fijada_hasta <= NOW())
      AND ($2::timestamptz IS NULL
       OR (card.ultima_actividad, card.id) < ($2::timestamptz, $3::bigint))
    ORDER BY card.ultima_actividad DESC, card.id DESC
    LIMIT $1
  `;
  const { rows } = await pool.query(q, [limit, cursorFecha, cursorId]);
  return rows;
};

// Fórmula y perfiles en config/feedConfig.js. Una sola query devuelve los sub-streams
// afín y exploración; el servicio los intercala. t0 y seed quedan fijos durante la visita.
// afin/explora: null (agotado), {} (desde el inicio) o { s, id } (cursor).
const getRankedCategoryFeed = async (viewerId, { limit, t0, seed, p, afin = {}, explora = {} }) => {
  const params = [
    viewerId,                                   // $1
    t0,                                         // $2
    seed,                                       // $3
    p.G, p.K, p.J, p.W_POP,                     // $4 $5 $6 $7
    FEED.A_MAX, FEED.W_PART, FEED.W_SUSC, FEED.W_TAG, // $8 $9 $10 $11
    FEED.AFINIDAD_CAP_ETIQUETA,                 // $12
    FEED.AFINIDAD_VENTANA_DIAS,                 // $13
    FEED.VIDA_MEDIA_PART_DIAS,                  // $14
    FEED.ACTIVIDAD_DIAS,                        // $15
    limit,                                      // $16
    afin !== null, afin?.s ?? null, afin?.id ?? null,          // $17 $18 $19
    explora !== null, explora?.s ?? null, explora?.id ?? null, // $20 $21 $22
    p.VENTANA_H,                                // $23
  ];
  const q = `
    WITH prm AS (SELECT to_timestamp($2::float8) AS t0),
    act AS (
      -- Una sola pasada sobre temas activos y comentarios visibles (no-Home) de
      -- cada categoría (directos o colgados de un tema).
      SELECT x.cat_id,
        MAX(x.fecha) AS ultima,
        COUNT(*) FILTER (WHERE x.es_tema AND x.fecha > prm.t0 - MAKE_INTERVAL(days => $15::int)) AS temas_7d,
        COUNT(*) FILTER (WHERE NOT x.es_tema AND x.fecha > prm.t0 - MAKE_INTERVAL(days => $15::int)) AS coms_7d,
        MAX(x.fecha) FILTER (WHERE x.autor_id = $1::bigint) AS mi_ultima
      FROM (
        SELECT t.categoria_id AS cat_id, con.fecha_creacion AS fecha, con.autor_id, TRUE AS es_tema
        FROM tema t
        JOIN contenido con ON con.id = t.contenido_id
        WHERE t.estado = 'activo'
        UNION ALL
        SELECT COALESCE(com.categoria_id, tc.categoria_id), con.fecha_creacion, con.autor_id, FALSE
        FROM comentario com
        JOIN contenido con ON con.id = com.contenido_id
        LEFT JOIN tema tc ON tc.contenido_id = com.tema_id
        WHERE com.estado = 'visible' AND com.es_home = FALSE
      ) x
      CROSS JOIN prm
      GROUP BY x.cat_id
    ),
    afin_etq AS (
      -- Likes del viewer en la ventana, mapeados a las etiquetas de la categoría
      -- del contenido likeado (tema, comentario de categoría o de tema).
      SELECT ce.etiqueta_id, LEAST(COUNT(*), $12::int)::float8 AS cnt
      FROM reaccion r
      CROSS JOIN prm
      LEFT JOIN tema t ON t.contenido_id = r.contenido_id
      LEFT JOIN comentario com ON com.contenido_id = r.contenido_id
      LEFT JOIN tema tcom ON tcom.contenido_id = com.tema_id
      JOIN categoria_etiqueta ce
        ON ce.categoria_id = COALESCE(t.categoria_id, com.categoria_id, tcom.categoria_id)
      WHERE r.usuario_id = $1::bigint AND r.tipo = 'meGusta'
        AND r.fecha_creacion > prm.t0 - MAKE_INTERVAL(days => $13::int)
      GROUP BY ce.etiqueta_id
    ),
    afin_cat AS (
      SELECT ce.categoria_id, LEAST(1::float8, SUM(a.cnt) / $12::float8) AS tag
      FROM categoria_etiqueta ce
      JOIN afin_etq a ON a.etiqueta_id = ce.etiqueta_id
      GROUP BY ce.categoria_id
    ),
    base AS (
      SELECT c.id,
        (pc.usuario_id IS NULL AND sc.usuario_id IS NULL) AS explora,
        CASE WHEN pc.usuario_id IS NULL THEN 0::float8
             ELSE power(2::float8, -GREATEST(0::float8,
                    EXTRACT(EPOCH FROM (prm.t0 - GREATEST(pc.fecha_asignacion, a.mi_ultima)))::float8 / 86400
                  ) / $14::float8)
        END AS part,
        CASE WHEN sc.usuario_id IS NULL THEN 0::float8 ELSE 1::float8 END AS susc,
        COALESCE(ac.tag, 0)::float8 AS tag,
        COALESCE(a.temas_7d, 0)::float8 AS temas_7d,
        COALESCE(a.coms_7d, 0)::float8 AS coms_7d,
        GREATEST(0::float8,
          EXTRACT(EPOCH FROM (prm.t0 - GREATEST(c.fecha_creacion, a.ultima)))::float8 / 3600
        ) AS edad_h,
        ((hashtextextended(c.id::text, $3::bigint) & 1048575)::float8 / 1048576) AS h
      FROM categoria c
      CROSS JOIN prm
      LEFT JOIN act a ON a.cat_id = c.id
      LEFT JOIN participacion_categoria pc ON pc.categoria_id = c.id AND pc.usuario_id = $1::bigint
      LEFT JOIN suscripcion_categoria sc ON sc.categoria_id = c.id AND sc.usuario_id = $1::bigint
      LEFT JOIN afin_cat ac ON ac.categoria_id = c.id
      WHERE c.estado = 'activa'
        AND (c.fijada_hasta IS NULL OR c.fijada_hasta <= NOW())
    ),
    scored AS (
      SELECT id, explora,
        ROUND(1e6 * (
            ln(1 + $5::float8 * LEAST($8::float8, $9::float8 * part + $10::float8 * susc + $11::float8 * tag))
          + $7::float8 * ln(1 + 3 * temas_7d + coms_7d)
          - $4::float8 * ln(LEAST(edad_h, $23::float8) + 2)
          + ln(1 + $6::float8 * (2 * h - 1))
        ))::bigint AS score
      FROM base
    ),
    picked AS (
      (SELECT id, score, explora FROM scored
        WHERE $17::boolean AND NOT explora
          AND ($18::bigint IS NULL OR (score, id) < ($18::bigint, $19::bigint))
        ORDER BY score DESC, id DESC
        LIMIT $16)
      UNION ALL
      (SELECT id, score, explora FROM scored
        WHERE $20::boolean AND explora
          AND ($21::bigint IS NULL OR (score, id) < ($21::bigint, $22::bigint))
        ORDER BY score DESC, id DESC
        LIMIT $16)
    )
    SELECT card.*, pk.score, pk.explora
    FROM (${categoryCardQuery({ viewerPh: '$1', idsFilter: 'SELECT id FROM picked' })}) card
    JOIN picked pk ON pk.id = card.id
    ORDER BY pk.explora, pk.score DESC, card.id DESC
  `;
  const { rows } = await pool.query(q, params);
  return rows;
};

const getParticipantsByCategoryId = async (categoriaId) => {
  const q = `
    SELECT u.id, u.nickname, u.nombre, pc.rol
    FROM participacion_categoria pc
    JOIN usuario u ON u.id = pc.usuario_id
    WHERE pc.categoria_id = $1 AND pc.rol = 'participante'
    ORDER BY u.nickname ASC
  `;
  const { rows } = await pool.query(q, [categoriaId]);
  return rows;
};

const getEtiquetas = async () => {
  const q = `SELECT id, nombre, nombre_display, grupo, orden FROM etiqueta ORDER BY grupo, orden, nombre`;
  const { rows } = await pool.query(q);
  return rows;
};

const getEtiquetasByIds = async (ids) => {
  const q = `SELECT id FROM etiqueta WHERE id = ANY($1::bigint[])`;
  const { rows } = await pool.query(q, [ids]);
  return rows.map(r => Number(r.id));
};

const searchEtiquetas = async (query, limit = 20) => {
  const q = `
    SELECT id, nombre, nombre_display, grupo
    FROM etiqueta
    WHERE nombre ILIKE $1 || '%' ESCAPE '\\'
    ORDER BY grupo, orden, nombre
    LIMIT $2
  `;
  const { rows } = await pool.query(q, [escapeLike(query), limit]);
  return rows;
};

const categoryHasContent = async (id) => {
  const q = `
    SELECT EXISTS(
      SELECT 1 FROM tema WHERE categoria_id = $1
      UNION ALL
      SELECT 1 FROM comentario WHERE categoria_id = $1
    ) AS has_content
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0].has_content;
};

const hardDeleteCategoryById = async (id) => {
  const q = `DELETE FROM categoria WHERE id = $1`;
  await pool.query(q, [id]);
};

// La presencia depende del conteo en la ventana; el orden, del score ponderado por recencia.
// Temas y comentarios se cuentan en CTEs separadas para evitar el producto cartesiano.
// days = null cuenta todo el historial.
const getPopularCategories = async (days = 7, limit = 20) => {
  const q = `
    WITH tema_act AS (
      SELECT t.categoria_id,
        COUNT(*) AS temas_recientes,
        SUM(POWER(0.5, GREATEST(EXTRACT(EPOCH FROM (NOW() - con.fecha_creacion)) / 3600.0, 0) / $3)) AS score
      FROM tema t
      JOIN contenido con ON con.id = t.contenido_id
      WHERE t.estado = 'activo'
        AND ($1::int IS NULL OR con.fecha_creacion > NOW() - MAKE_INTERVAL(days => $1::int))
      GROUP BY t.categoria_id
    ),
    com_act AS (
      SELECT COALESCE(com.categoria_id, tt.categoria_id) AS categoria_id,
        COUNT(*) AS comentarios_recientes,
        -- Comentarios DIRECTOS a la categoría y de PRIMER NIVEL (mismo criterio
        -- que contador_comentarios / el tab "Comentarios"): excluye las
        -- respuestas anidadas y los comentarios que cuelgan de temas. Es lo que
        -- muestra la card (hero "Categoría de la semana" / Populares); el conteo
        -- crudo de arriba sigue alimentando el ranking y la presencia.
        COUNT(*) FILTER (WHERE com.categoria_id IS NOT NULL AND com.comentario_padre_id IS NULL) AS comentarios_directos_recientes,
        SUM(POWER(0.5, GREATEST(EXTRACT(EPOCH FROM (NOW() - con.fecha_creacion)) / 3600.0, 0) / $3)) AS score
      FROM comentario com
      JOIN contenido con ON con.id = com.contenido_id
      LEFT JOIN tema tt ON tt.contenido_id = com.tema_id
      WHERE com.estado = 'visible'
        AND ($1::int IS NULL OR con.fecha_creacion > NOW() - MAKE_INTERVAL(days => $1::int))
      GROUP BY COALESCE(com.categoria_id, tt.categoria_id)
    )
    SELECT c.id, c.titulo, c.descripcion, c.contador_temas,
      c.fecha_creacion, u.nickname AS autor_nickname, u.facultad AS autor_facultad,
      -- Total general de comentarios directos (top-level) de la categoría, para
      -- exponerlo junto a contador_temas en la card (aparte de los "recientes").
      (SELECT COUNT(*) FROM comentario cc
         WHERE cc.categoria_id = c.id AND cc.comentario_padre_id IS NULL) AS contador_comentarios,
      ARRAY_AGG(DISTINCT e.nombre) FILTER (WHERE e.nombre IS NOT NULL) AS etiquetas,
      COALESCE(ta.temas_recientes, 0) AS temas_recientes,
      COALESCE(ca.comentarios_recientes, 0) AS comentarios_recientes,
      COALESCE(ca.comentarios_directos_recientes, 0) AS comentarios_directos_recientes,
      (COALESCE(ta.temas_recientes, 0) + COALESCE(ca.comentarios_recientes, 0)) AS actividad_total,
      (COALESCE(ta.score, 0) * $4 + COALESCE(ca.score, 0) * $5) AS actividad_score
    FROM categoria c
    JOIN usuario u ON u.id = c.autor_id
    LEFT JOIN tema_act ta ON ta.categoria_id = c.id
    LEFT JOIN com_act ca ON ca.categoria_id = c.id
    LEFT JOIN categoria_etiqueta ce ON ce.categoria_id = c.id
    LEFT JOIN etiqueta e ON e.id = ce.etiqueta_id
    WHERE c.estado = 'activa'
      AND (COALESCE(ta.temas_recientes, 0) + COALESCE(ca.comentarios_recientes, 0)) > 0
    GROUP BY c.id, u.nickname, u.facultad, ta.temas_recientes, ta.score, ca.comentarios_recientes, ca.comentarios_directos_recientes, ca.score
    ORDER BY actividad_score DESC, c.fecha_creacion DESC
    LIMIT $2
  `;
  const { rows } = await pool.query(q, [days, limit, halfLifeHours(days), W_TEMA, W_COMENTARIO]);
  return rows;
};

export { createCategory, findCategoryByTitulo, getCategories, getCategoryById,
  getTopicsByCategoryId, deactivateCategoryById, activeCategoryById, getCategoriesByAuthorId,
  updateCategoryById, assignParticipantRole, getActiveCategories, getCategoryIndex, getParticipantsByCategoryId,
  getChronoFeed, getRankedCategoryFeed,
  getEtiquetas, getEtiquetasByIds, searchEtiquetas,
  categoryHasContent, hardDeleteCategoryById, getPopularCategories,
  getCategoryEditHistory, pinCategoryComment, unpinCategoryComment, pinCategoryTopic, unpinCategoryTopic,
  pinCategoryHome, unpinCategoryHome, getPinnedHomeCategory,
  subscribeCategory, unsubscribeCategory, isSubscribedCategory, getCategorySubscribers };

async function subscribeCategory(usuarioId, categoriaId) {
  await pool.query(
    `INSERT INTO suscripcion_categoria (usuario_id, categoria_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [usuarioId, categoriaId]
  );
}

async function unsubscribeCategory(usuarioId, categoriaId) {
  await pool.query(
    `DELETE FROM suscripcion_categoria WHERE usuario_id = $1 AND categoria_id = $2`,
    [usuarioId, categoriaId]
  );
}

async function isSubscribedCategory(usuarioId, categoriaId) {
  const { rows } = await pool.query(
    `SELECT 1 FROM suscripcion_categoria WHERE usuario_id = $1 AND categoria_id = $2`,
    [usuarioId, categoriaId]
  );
  return rows.length > 0;
}

// Excluye a quienes se notifican aparte (el actor y el autor de la categoría).
async function getCategorySubscribers(categoriaId, excludeIds = []) {
  const { rows } = await pool.query(
    `SELECT usuario_id FROM suscripcion_categoria
     WHERE categoria_id = $1 AND usuario_id <> ALL($2::bigint[])`,
    [categoriaId, excludeIds]
  );
  return rows.map(r => r.usuario_id);
}

// Un solo fijado por columna: fijar otro reemplaza al anterior. El EXISTS valida
// que el ítem pertenezca a la categoría.

async function pinCategoryComment(categoriaId, comentarioId) {
  const q = `
    UPDATE categoria SET comentario_fijado_id = $2
    WHERE id = $1 AND EXISTS (
      SELECT 1 FROM comentario WHERE contenido_id = $2 AND categoria_id = $1
        AND comentario_padre_id IS NULL AND estado = 'visible'
    )
    RETURNING id
  `;
  const { rows } = await pool.query(q, [categoriaId, comentarioId]);
  return rows[0] || null;
}

async function unpinCategoryComment(categoriaId) {
  await pool.query(`UPDATE categoria SET comentario_fijado_id = NULL WHERE id = $1`, [categoriaId]);
}

async function pinCategoryTopic(categoriaId, temaId) {
  const q = `
    UPDATE categoria SET tema_fijado_id = $2
    WHERE id = $1 AND EXISTS (
      SELECT 1 FROM tema WHERE contenido_id = $2 AND categoria_id = $1 AND estado = 'activo'
    )
    RETURNING id
  `;
  const { rows } = await pool.query(q, [categoriaId, temaId]);
  return rows[0] || null;
}

async function unpinCategoryTopic(categoriaId) {
  await pool.query(`UPDATE categoria SET tema_fijado_id = NULL WHERE id = $1`, [categoriaId]);
}

// A lo sumo una categoría fijada a la vez; solo cuenta mientras fijada_hasta > NOW().

async function pinCategoryHome(categoriaId, fijadaHasta) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // El destacado del Home es único: fijar una categoría desancla también el comentario fijado.
    await client.query(`UPDATE categoria SET fijada_hasta = NULL WHERE fijada_hasta IS NOT NULL`);
    await client.query(`UPDATE comentario SET fijado_home_hasta = NULL WHERE fijado_home_hasta IS NOT NULL`);
    const { rows } = await client.query(
      `UPDATE categoria SET fijada_hasta = $2
       WHERE id = $1 AND estado = 'activa'
       RETURNING id, fijada_hasta`,
      [categoriaId, fijadaHasta]
    );
    await client.query('COMMIT');
    return rows[0] || null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function unpinCategoryHome(categoriaId) {
  await pool.query(`UPDATE categoria SET fijada_hasta = NULL WHERE id = $1`, [categoriaId]);
}

async function getPinnedHomeCategory(viewerId = null) {
  const withViewer = viewerId != null;
  const q = `
    SELECT card.* FROM (${withViewer ? categoryCardQuery({ viewerPh: '$1' }) : CATEGORY_CARD_QUERY}) card
    WHERE card.fijada_hasta > NOW()
    LIMIT 1
  `;
  const { rows } = await pool.query(q, withViewer ? [viewerId] : []);
  return rows[0] || null;
}