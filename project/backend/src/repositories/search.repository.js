import pool from '../config/db.js';
import { escapeLike } from '../utils/escapeLike.js';

// ─────────────────────────────────────────────────────────────────────────────
// Búsqueda unificada del sitio: cuatro secciones independientes (categorías,
// temas, comentarios, usuarios). NO hay ranking cross-tipo ni lista mixta: cada
// sección se ordena y pagina sola.
//
// Reglas transversales (ver también search.service.js):
//   · Match de contenido por SUBSTRING con acentos normalizados:
//     strpos(unaccent(lower(campo)), unaccent(lower($1))) > 0. Nunca regex sobre
//     input del usuario (`~`, `~*`): "c++" o "(hola" serían patrones inválidos
//     → 500, y hay backtracking catastrófico. strpos es literal y seguro.
//   · El término entra SIEMPRE como parámetro $1, jamás concatenado al SQL.
//   · `etiqueta` llega normalizada a '' (nunca NULL) desde el service, para que
//     `$2 = ''` no se evalúe como NULL y anule la sección.
//   · Orden total estable: todo ORDER BY termina en `id DESC`. Sin desempate,
//     LIMIT/OFFSET ("ver más") repetiría y saltearía filas.
//   · ORDER BY y LIMIT/OFFSET viven en el nivel más externo de cada query, nunca
//     dentro de un CTE/subquery: Postgres inlinea CTEs referenciados una sola vez
//     y puede descartar un ORDER BY interno.
//   · hasMore se resuelve pidiendo LIMIT+1 y viendo si sobra una fila (el service
//     recorta), no con un COUNT(*) aparte.
// ─────────────────────────────────────────────────────────────────────────────

// Ventana del fragmento (snippet) alrededor del match, en caracteres.
const SNIP_BEFORE = 40;
const SNIP_AFTER = 80;

// Genera los dos LATERAL que producen el snippet partido en TRES campos de texto
// plano (snippet_before / snippet_match / snippet_after). El front resalta
// envolviendo snippet_match en un <mark> (nodo React), sin aritmética de índices
// ni dangerouslySetInnerHTML.
//
// Por qué partido en tres y no offset+largo: strpos cuenta caracteres Postgres y
// JS indexa por code units UTF-16 — un emoji antes del match desalinea. Además
// unaccent puede cambiar el largo (ß→ss, æ→ae); acá el corte se hace en SQL sobre
// el texto ORIGINAL, así que el front nunca cruza esa frontera. Para acentos del
// español unaccent mapea 1:1, por eso el largo del match coincide con el término.
//
// `col` es un identificador SQL fijo del call site (b.descripcion, b.cuerpo,
// cb.cuerpo) — NUNCA input del usuario. Si el match es 0 (matcheó solo por
// título, p. ej.), los tres campos quedan NULL.
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

// ── Categorías ────────────────────────────────────────────────────────────────
// Matchea título (substring), descripción (substring) o nombre de etiqueta
// (igualdad exacta normalizada — mismo criterio que /categories/active, testeado).
// Orden: match en título primero, después el resto; dentro de cada grupo id DESC.
// Visibilidad: categoría activa + autor activo.
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

// ── Temas ─────────────────────────────────────────────────────────────────────
// Matchea título del tema o su cuerpo (contenido.cuerpo). Con etiqueta, restringe
// a temas cuya CATEGORÍA tiene esa etiqueta. Orden: cantidad de comentarios
// visibles DESC, después id DESC.
// Visibilidad: tema activo + su categoría activa + autor del tema activo.
// El conteo que ordena usa una subquery escalar correlacionada (no un LEFT JOIN
// con filtro en el WHERE): un tema sin comentarios visibles devuelve 0 y sigue
// apareciendo, en vez de desaparecer del resultado. Ese conteo cuenta solo
// comentarios visibles, no inactivados y de autor activo.
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

// ── Comentarios ───────────────────────────────────────────────────────────────
// SOLO nivel 1 (comentario_padre_id IS NULL), en los tres ámbitos (es_home,
// tema, categoría). El conjunto buscable se define ENTERO en un único CTE
// nombrado (`comentarios_buscables`): filtro de ámbito (nivel 1) y TODOS los
// filtros de visibilidad viven adentro. Ampliar a respuestas anidadas después es
// cambiar este CTE, no auditar WHERE dispersos. El ORDER BY / LIMIT quedan fuera.
//
// Con etiqueta: los comentarios de HOME quedan excluidos (no pertenecen a
// ninguna categoría, no heredan etiqueta). Los de tema/categoría se restringen a
// la etiqueta de su categoría.
// Orden: likes DESC, fecha DESC, id DESC. "Like" = reaccion.tipo 'meGusta'
// (enum tipo_reaccion en schema.sql).
const searchComentarios = async ({ term, etiqueta, limit, offset = 0 }) => {
  const q = `
    WITH comentarios_buscables AS (
      SELECT cm.contenido_id AS id, con.cuerpo, con.fecha_creacion,
             u.nickname AS autor_nickname, u.url_imagen AS autor_url_imagen,
             CASE WHEN cm.es_home THEN 'home'
                  WHEN cm.tema_id IS NOT NULL THEN 'tema'
                  ELSE 'categoria' END AS tipo,
             COALESCE(cm.tema_id, cm.categoria_id) AS destino_id,
             COALESCE(t_dest.titulo, cat_dest.titulo) AS destino_titulo,
             (SELECT COUNT(*) FROM reaccion r
               WHERE r.contenido_id = cm.contenido_id AND r.tipo = 'meGusta') AS likes
      FROM comentario cm
      JOIN contenido con ON con.id = cm.contenido_id
      JOIN usuario u ON u.id = con.autor_id AND u.estado = 'activo'
      LEFT JOIN tema t_dest ON t_dest.contenido_id = cm.tema_id
      LEFT JOIN categoria cat_dest ON cat_dest.id = cm.categoria_id
      WHERE cm.comentario_padre_id IS NULL
        AND cm.estado = 'visible'
        AND cm.motivo_inactivacion IS NULL
        AND strpos(unaccent(lower(con.cuerpo)), unaccent(lower($1))) > 0
        AND (
          cm.es_home
          OR (cm.tema_id IS NOT NULL
              AND t_dest.estado = 'activo'
              AND EXISTS (SELECT 1 FROM categoria c2
                          WHERE c2.id = t_dest.categoria_id AND c2.estado = 'activa'))
          OR (cm.categoria_id IS NOT NULL AND cat_dest.estado = 'activa')
        )
        AND ($2 = '' OR (
          NOT cm.es_home
          AND EXISTS (
            SELECT 1 FROM categoria_etiqueta cef
            JOIN etiqueta ef ON ef.id = cef.etiqueta_id
            WHERE cef.categoria_id = COALESCE(cm.categoria_id, t_dest.categoria_id)
              AND unaccent(lower(ef.nombre)) = unaccent(lower($2))
          )
        ))
    )
    SELECT cb.id, cb.fecha_creacion, cb.autor_nickname, cb.autor_url_imagen,
           cb.tipo, cb.destino_id, cb.destino_titulo, cb.likes,
           sn.snippet_before, sn.snippet_match, sn.snippet_after
    FROM comentarios_buscables cb
    ${snippetJoins('cb.cuerpo')}
    ORDER BY cb.likes DESC, cb.fecha_creacion DESC, cb.id DESC
    LIMIT $3 OFFSET $4
  `;
  const { rows } = await pool.query(q, [term, etiqueta, limit, offset]);
  return rows;
};

// ── Usuarios ──────────────────────────────────────────────────────────────────
// Conserva la semántica del endpoint existente /api/users/search: match por
// ILIKE substring sobre nickname/nombre (acá SÍ va LIKE, con comodines escapados
// vía escapeLike + cláusula ESCAPE) y exclusión BIDIRECCIONAL de bloqueados
// respecto del viewer (misma subquery que user.repository.searchUsers).
// Orden: prefijo de nickname primero, después alfabético, con id DESC de cierre
// para orden total estable en "ver más".
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
