import pool from '../config/db.js';
import { encuestaSubquery } from './encuesta.repository.js';
import { TRENDING } from '../config/trendingConfig.js';
import { FEED } from '../config/feedConfig.js';

const { HALF_LIFE_HOURS, W_TEMA, W_COMENTARIO } = TRENDING;

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

    // Asignar rol moderador al autor
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
      u.nickname AS autor_nickname, u.url_imagen AS autor_url_imagen, u.estado AS autor_estado,
      (SELECT COUNT(*) FROM tema t WHERE t.categoria_id = c.id AND t.estado = 'activo') AS contador_temas,
      ARRAY_AGG(e.nombre) AS etiquetas
    FROM categoria c
    JOIN usuario u ON u.id = c.autor_id
    LEFT JOIN categoria_etiqueta ce ON ce.categoria_id = c.id
    LEFT JOIN etiqueta e ON e.id = ce.etiqueta_id
    WHERE c.id = $1
    GROUP BY c.id, u.nickname, u.url_imagen, u.estado
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
      u.nickname AS autor_nickname, u.url_imagen AS autor_url_imagen, u.estado AS autor_estado,
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
      // Obtener descripción actual antes de sobreescribir
      const { rows: currentRows } = await client.query(
        `SELECT descripcion FROM categoria WHERE id = $1`,
        [id]
      );

      const currentDesc = currentRows[0]?.descripcion;

      // Solo guardar historial si la descripción realmente cambió
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

// Fragmento compartido: la "card" completa de una categoría activa (columnas
// que consumen Home y Recientes). Lo usan getActiveCategories y el feed
// paginado de Home, que le agregan su propio ORDER BY / cursor por fuera.
const CATEGORY_CARD_QUERY = `
    SELECT c.id, c.titulo, c.descripcion, c.contador_temas,
      c.fecha_creacion, c.icono, u.nickname AS autor_nickname, u.estado AS autor_estado,
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
        WHERE t.categoria_id = c.id AND t.estado = 'activo'
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
          'fecha_creacion', con2.fecha_creacion,
          'likes', (SELECT COUNT(*) FROM reaccion r WHERE r.contenido_id = com.contenido_id AND r.tipo = 'meGusta'),
          'contador_respuestas', (SELECT COUNT(*) FROM comentario child WHERE child.comentario_padre_id = com.contenido_id AND child.estado = 'visible'),
          'adjuntos', (
            SELECT COALESCE(json_agg(json_build_object('id', a.id, 'url', a.url, 'nombre_original', a.nombre_original, 'tipo', a.tipo, 'tamano', a.tamano) ORDER BY a.id), '[]'::json)
            FROM adjunto a WHERE a.contenido_id = com.contenido_id
          ),
          'encuesta', ${encuestaSubquery('NULL::bigint')}
        )
        FROM comentario com
        JOIN contenido con2 ON con2.id = com.contenido_id
        JOIN usuario u3 ON u3.id = con2.autor_id
        WHERE com.categoria_id = c.id
          AND com.comentario_padre_id IS NULL
          AND com.estado = 'visible'
        ORDER BY COALESCE(com.contenido_id = c.comentario_fijado_id, false) DESC,
                 con2.fecha_creacion DESC
        LIMIT 1
      ) AS ultimo_comentario
    FROM categoria c
    JOIN usuario u ON u.id = c.autor_id
    LEFT JOIN categoria_etiqueta ce ON ce.categoria_id = c.id
    LEFT JOIN etiqueta e ON e.id = ce.etiqueta_id
    WHERE c.estado = 'activa'
    GROUP BY c.id, u.nickname, u.estado
`;

const getActiveCategories = async () => {
  const q = `${CATEGORY_CARD_QUERY} ORDER BY c.titulo DESC`;
  const { rows } = await pool.query(q);
  return rows;
};

// ── Feed del Home ──
// Modo cronológico (invitados y cold start): fecha_creacion DESC, igual que
// Recientes. Cursor compuesto (fecha_creacion, id) para que empates de fecha
// no repitan ni salten filas entre páginas.
const getChronoFeed = async ({ limit, cursorFecha = null, cursorId = null }) => {
  const q = `
    SELECT card.* FROM (${CATEGORY_CARD_QUERY}) card
    WHERE $2::timestamptz IS NULL
       OR (card.fecha_creacion, card.id) < ($2::timestamptz, $3::bigint)
    ORDER BY card.fecha_creacion DESC, card.id DESC
    LIMIT $1
  `;
  const { rows } = await pool.query(q, [limit, cursorFecha, cursorId]);
  return rows;
};

// Modo personalizado: puntaje por usuario según config/feedConfig.js.
// El puntaje es entero y estable dentro del día, así el cursor (score, id)
// pagina sin repetir ni saltar aunque haya empates.
const getPersonalizedFeed = async (usuarioId, { limit, cursorScore = null, cursorId = null }) => {
  const q = `
    WITH afinidad AS (
      -- Frecuencia de etiquetas en el historial de likes del usuario: cada
      -- 'meGusta' se mapea a la categoría de su contenido (tema directo,
      -- comentario de categoría, o comentario colgado de un tema) y de ahí
      -- a sus etiquetas.
      SELECT ce.etiqueta_id, COUNT(*)::int AS cnt
      FROM reaccion r
      LEFT JOIN tema t ON t.contenido_id = r.contenido_id
      LEFT JOIN comentario com ON com.contenido_id = r.contenido_id
      LEFT JOIN tema tcom ON tcom.contenido_id = com.tema_id
      JOIN categoria_etiqueta ce
        ON ce.categoria_id = COALESCE(t.categoria_id, com.categoria_id, tcom.categoria_id)
      WHERE r.usuario_id = $1 AND r.tipo = 'meGusta'
      GROUP BY ce.etiqueta_id
    ),
    scored AS (
      SELECT c2.id AS cat_id,
        (
          CASE WHEN EXISTS (
            SELECT 1 FROM participacion_categoria pc
            WHERE pc.categoria_id = c2.id AND pc.usuario_id = $1
          ) THEN ${FEED.W_PARTICIPACION} ELSE 0 END
        + CASE WHEN EXISTS (
            SELECT 1 FROM suscripcion_categoria sc
            WHERE sc.categoria_id = c2.id AND sc.usuario_id = $1
          ) THEN ${FEED.W_SUSCRIPCION} ELSE 0 END
        + ${FEED.W_ETIQUETA} * COALESCE((
            SELECT SUM(LEAST(a.cnt, ${FEED.AFINIDAD_CAP_ETIQUETA}))
            FROM categoria_etiqueta ce2
            JOIN afinidad a ON a.etiqueta_id = ce2.etiqueta_id
            WHERE ce2.categoria_id = c2.id
          ), 0)
        + ${FEED.W_ACT_TEMA} * (
            SELECT COUNT(*) FROM tema t2
            JOIN contenido con ON con.id = t2.contenido_id
            WHERE t2.categoria_id = c2.id AND t2.estado = 'activo'
              AND con.fecha_creacion > NOW() - MAKE_INTERVAL(days => ${FEED.ACTIVIDAD_DIAS})
          )
        + ${FEED.W_ACT_COMENTARIO} * (
            SELECT COUNT(*) FROM comentario com2
            JOIN contenido con2 ON con2.id = com2.contenido_id
            LEFT JOIN tema t3 ON t3.contenido_id = com2.tema_id
            WHERE COALESCE(com2.categoria_id, t3.categoria_id) = c2.id
              AND com2.estado = 'visible'
              AND con2.fecha_creacion > NOW() - MAKE_INTERVAL(days => ${FEED.ACTIVIDAD_DIAS})
          )
        + ${FEED.W_NOVEDAD_DIA} * GREATEST(0,
            ${FEED.NOVEDAD_DIAS} - FLOOR(EXTRACT(EPOCH FROM (NOW() - c2.fecha_creacion)) / 86400)
          )
        )::bigint AS score
      FROM categoria c2
      WHERE c2.estado = 'activa'
    )
    SELECT card.*, s.score
    FROM (${CATEGORY_CARD_QUERY}) card
    JOIN scored s ON s.cat_id = card.id
    WHERE $3::bigint IS NULL
       OR (s.score, card.id) < ($3::bigint, $4::bigint)
    ORDER BY s.score DESC, card.id DESC
    LIMIT $2
  `;
  const { rows } = await pool.query(q, [usuarioId, limit, cursorScore, cursorId]);
  return rows;
};

// ¿El usuario tiene alguna señal personalizable? Si no (cuenta nueva),
// Home cae al modo cronológico en vez de rankear con todo en cero.
const hasFeedSignals = async (usuarioId) => {
  const q = `
    SELECT EXISTS (SELECT 1 FROM participacion_categoria WHERE usuario_id = $1)
        OR EXISTS (SELECT 1 FROM suscripcion_categoria WHERE usuario_id = $1)
        OR EXISTS (SELECT 1 FROM reaccion WHERE usuario_id = $1 AND tipo = 'meGusta')
        AS tiene
  `;
  const { rows } = await pool.query(q, [usuarioId]);
  return rows[0].tiene === true;
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
    WHERE nombre ILIKE $1 || '%'
    ORDER BY grupo, orden, nombre
    LIMIT $2
  `;
  const { rows } = await pool.query(q, [query, limit]);
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

// Categorías "populares esta semana": ranking por actividad reciente ponderada
// por recencia (decaimiento exponencial, ver trendingConfig). La PRESENCIA en
// la lista depende del conteo crudo de temas/comentarios dentro de la ventana
// (>0); el ORDEN depende del score ponderado, para que actividad reciente real
// mande sobre categorías antiguas. Los conteos de tema y comentario se calculan
// en CTEs separadas para evitar el producto cartesiano tema×comentario.
const getPopularCategories = async (days = 7, limit = 20) => {
  const q = `
    WITH tema_act AS (
      SELECT t.categoria_id,
        COUNT(*) AS temas_recientes,
        SUM(POWER(0.5, GREATEST(EXTRACT(EPOCH FROM (NOW() - con.fecha_creacion)) / 3600.0, 0) / $3)) AS score
      FROM tema t
      JOIN contenido con ON con.id = t.contenido_id
      WHERE t.estado = 'activo'
        AND con.fecha_creacion > NOW() - MAKE_INTERVAL(days => $1)
      GROUP BY t.categoria_id
    ),
    com_act AS (
      SELECT COALESCE(com.categoria_id, tt.categoria_id) AS categoria_id,
        COUNT(*) AS comentarios_recientes,
        SUM(POWER(0.5, GREATEST(EXTRACT(EPOCH FROM (NOW() - con.fecha_creacion)) / 3600.0, 0) / $3)) AS score
      FROM comentario com
      JOIN contenido con ON con.id = com.contenido_id
      LEFT JOIN tema tt ON tt.contenido_id = com.tema_id
      WHERE com.estado = 'visible'
        AND con.fecha_creacion > NOW() - MAKE_INTERVAL(days => $1)
      GROUP BY COALESCE(com.categoria_id, tt.categoria_id)
    )
    SELECT c.id, c.titulo, c.descripcion, c.contador_temas,
      c.fecha_creacion, u.nickname AS autor_nickname,
      ARRAY_AGG(DISTINCT e.nombre) FILTER (WHERE e.nombre IS NOT NULL) AS etiquetas,
      COALESCE(ta.temas_recientes, 0) AS temas_recientes,
      COALESCE(ca.comentarios_recientes, 0) AS comentarios_recientes,
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
    GROUP BY c.id, u.nickname, ta.temas_recientes, ta.score, ca.comentarios_recientes, ca.score
    ORDER BY actividad_score DESC, c.fecha_creacion DESC
    LIMIT $2
  `;
  const { rows } = await pool.query(q, [days, limit, HALF_LIFE_HOURS, W_TEMA, W_COMENTARIO]);
  return rows;
};

// Etiquetas en tendencia: mide actividad REAL de los últimos `days` días —
// temas activos creados en la ventana, agrupados por la(s) etiqueta(s) de su
// categoría. Ordena por cantidad de temas recientes (desempate por comentarios
// recientes en esos temas). Reemplaza el conteo estático de frecuencia.
const getTrendingTags = async (days = 7, limit = 8) => {
  const q = `
    SELECT e.nombre AS etiqueta,
      COUNT(DISTINCT t.contenido_id) AS temas_recientes,
      COUNT(com.contenido_id) AS comentarios_recientes
    FROM categoria_etiqueta ce
    JOIN etiqueta e ON e.id = ce.etiqueta_id
    JOIN categoria c ON c.id = ce.categoria_id AND c.estado = 'activa'
    JOIN tema t ON t.categoria_id = ce.categoria_id AND t.estado = 'activo'
    JOIN contenido con ON con.id = t.contenido_id
      AND con.fecha_creacion > NOW() - MAKE_INTERVAL(days => $1)
    LEFT JOIN comentario com ON com.tema_id = t.contenido_id AND com.estado = 'visible'
    GROUP BY e.nombre
    HAVING COUNT(DISTINCT t.contenido_id) > 0
    ORDER BY temas_recientes DESC, comentarios_recientes DESC, e.nombre ASC
    LIMIT $2
  `;
  const { rows } = await pool.query(q, [days, limit]);
  return rows;
};

export { createCategory, findCategoryByTitulo, getCategories, getCategoryById,
  getTopicsByCategoryId, deactivateCategoryById, activeCategoryById, getCategoriesByAuthorId,
  updateCategoryById, assignParticipantRole, getActiveCategories, getParticipantsByCategoryId,
  getChronoFeed, getPersonalizedFeed, hasFeedSignals,
  getEtiquetas, getEtiquetasByIds, searchEtiquetas,
  categoryHasContent, hardDeleteCategoryById, getPopularCategories, getTrendingTags,
  getCategoryEditHistory, pinCategoryComment, unpinCategoryComment, pinCategoryTopic, unpinCategoryTopic,
  subscribeCategory, unsubscribeCategory, isSubscribedCategory, getCategorySubscribers };

// ── Suscripción a categoría (campanita) ──
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

// Ids de los suscriptores de una categoría, excluyendo opcionalmente algunos
// (el actor del evento y el autor de la categoría, que se notifican aparte).
async function getCategorySubscribers(categoriaId, excludeIds = []) {
  const { rows } = await pool.query(
    `SELECT usuario_id FROM suscripcion_categoria
     WHERE categoria_id = $1 AND usuario_id <> ALL($2::bigint[])`,
    [categoriaId, excludeIds]
  );
  return rows.map(r => r.usuario_id);
}

// ── Fijados (moderador = creador de la categoría) ──
// Cada columna admite a lo sumo un id; sobreescribir auto-desancla el anterior.
// El guard EXISTS valida que el item pertenezca a la categoría.

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