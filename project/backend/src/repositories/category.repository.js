import pool from '../config/db.js';

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

    for (const etiqueta of etiquetas) {
      await client.query(
        `INSERT INTO categoria_etiqueta (categoria_id, etiqueta_valor) VALUES ($1, $2)`,
        [category.id, etiqueta]
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
      ARRAY_AGG(ce.etiqueta_valor) AS etiquetas
    FROM categoria c
    LEFT JOIN categoria_etiqueta ce ON ce.categoria_id = c.id
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
      ARRAY_AGG(ce.etiqueta_valor) AS etiquetas
    FROM categoria c
    JOIN usuario u ON u.id = c.autor_id
    LEFT JOIN categoria_etiqueta ce ON ce.categoria_id = c.id
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
      ARRAY_AGG(ce.etiqueta_valor) AS etiquetas
    FROM categoria c
    LEFT JOIN categoria_etiqueta ce ON ce.categoria_id = c.id
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
      for (const etiqueta of etiquetas) {
        await client.query(
          `INSERT INTO categoria_etiqueta (categoria_id, etiqueta_valor) VALUES ($1, $2)`,
          [id, etiqueta]
        );
      }
    }

    await client.query('COMMIT');

    const { rows } = await client.query(
      `SELECT c.id, c.titulo, c.descripcion, c.estado, c.icono,
        ARRAY_AGG(ce.etiqueta_valor) AS etiquetas
       FROM categoria c
       LEFT JOIN categoria_etiqueta ce ON ce.categoria_id = c.id
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

const getActiveCategories = async () => {
  const q = `
    SELECT c.id, c.titulo, c.descripcion, c.contador_temas,
      c.fecha_creacion, c.icono, u.nickname AS autor_nickname, u.estado AS autor_estado,
      ARRAY_AGG(ce.etiqueta_valor) AS etiquetas,
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
        -- Último comentario directo a la categoría (sin padre, visible) para el
        -- preview en la CategoryCard del Home. NULL si no hay comentarios.
        SELECT json_build_object(
          'id', com.contenido_id,
          'cuerpo', con2.cuerpo,
          'autor_nickname', u3.nickname,
          'autor_url_imagen', u3.url_imagen,
          'autor_estado', u3.estado,
          'fecha_creacion', con2.fecha_creacion,
          'likes', (SELECT COUNT(*) FROM reaccion r WHERE r.contenido_id = com.contenido_id AND r.tipo = 'meGusta'),
          'contador_respuestas', (SELECT COUNT(*) FROM comentario child WHERE child.comentario_padre_id = com.contenido_id AND child.estado = 'visible')
        )
        FROM comentario com
        JOIN contenido con2 ON con2.id = com.contenido_id
        JOIN usuario u3 ON u3.id = con2.autor_id
        WHERE com.categoria_id = c.id
          AND com.comentario_padre_id IS NULL
          AND com.estado = 'visible'
        ORDER BY con2.fecha_creacion DESC
        LIMIT 1
      ) AS ultimo_comentario
    FROM categoria c
    JOIN usuario u ON u.id = c.autor_id
    LEFT JOIN categoria_etiqueta ce ON ce.categoria_id = c.id
    WHERE c.estado = 'activa'
    GROUP BY c.id, u.nickname, u.estado
    ORDER BY c.titulo DESC
  `;
  const { rows } = await pool.query(q);
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
  const q = `SELECT unnest(enum_range(NULL::etiqueta))::text AS valor ORDER BY valor`;
  const { rows } = await pool.query(q);
  return rows.map(r => r.valor);
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

const getPopularCategories = async (days = 7, limit = 20) => {
  const q = `
    WITH actividad AS (
      SELECT c.id AS categoria_id,
        COUNT(DISTINCT CASE 
          WHEN t.estado = 'activo' AND con_t.fecha_creacion > NOW() - MAKE_INTERVAL(days => $1)
          THEN t.contenido_id END) AS temas_recientes,
        COUNT(DISTINCT CASE 
          WHEN com.estado = 'visible' AND con_c.fecha_creacion > NOW() - MAKE_INTERVAL(days => $1)
          THEN com.contenido_id END) AS comentarios_recientes
      FROM categoria c
      LEFT JOIN tema t ON t.categoria_id = c.id
      LEFT JOIN contenido con_t ON con_t.id = t.contenido_id
      LEFT JOIN comentario com ON (com.categoria_id = c.id OR com.tema_id = t.contenido_id)
      LEFT JOIN contenido con_c ON con_c.id = com.contenido_id
      WHERE c.estado = 'activa'
      GROUP BY c.id
      HAVING COUNT(DISTINCT CASE 
          WHEN t.estado = 'activo' AND con_t.fecha_creacion > NOW() - MAKE_INTERVAL(days => $1)
          THEN t.contenido_id END)
        + COUNT(DISTINCT CASE 
          WHEN com.estado = 'visible' AND con_c.fecha_creacion > NOW() - MAKE_INTERVAL(days => $1)
          THEN com.contenido_id END) > 0
    )
    SELECT c.id, c.titulo, c.descripcion, c.contador_temas,
      c.fecha_creacion, u.nickname AS autor_nickname,
      ARRAY_AGG(DISTINCT ce.etiqueta_valor) FILTER (WHERE ce.etiqueta_valor IS NOT NULL) AS etiquetas,
      a.temas_recientes, a.comentarios_recientes,
      (a.temas_recientes + a.comentarios_recientes) AS actividad_total
    FROM actividad a
    JOIN categoria c ON c.id = a.categoria_id
    JOIN usuario u ON u.id = c.autor_id
    LEFT JOIN categoria_etiqueta ce ON ce.categoria_id = c.id
    GROUP BY c.id, u.nickname, a.temas_recientes, a.comentarios_recientes
    ORDER BY actividad_total DESC, c.fecha_creacion DESC
    LIMIT $2
  `;
  const { rows } = await pool.query(q, [days, limit]);
  return rows;
};

export { createCategory, findCategoryByTitulo, getCategories, getCategoryById, 
  getTopicsByCategoryId, deactivateCategoryById, activeCategoryById, getCategoriesByAuthorId, 
  updateCategoryById, assignParticipantRole, getActiveCategories, getParticipantsByCategoryId,
  getEtiquetas, categoryHasContent, hardDeleteCategoryById, getPopularCategories,
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