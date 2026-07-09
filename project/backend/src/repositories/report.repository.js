import pool from '../config/db.js';

// =========================================================
// Reporte repository (Fase 4.A)
// =========================================================

// ---------------------------------------------------------
// Inserta un reporte. El UNIQUE(usuario_id, contenido_id) del schema
// garantiza "un usuario no reporta dos veces el mismo contenido": si se
// viola, Postgres tira error 23505 y el service lo traduce.
// ---------------------------------------------------------
const createReporte = async ({ usuario_id, contenido_id, motivo }) => {
  const q = `
    INSERT INTO reporte (usuario_id, contenido_id, motivo)
    VALUES ($1, $2, $3)
    RETURNING id, usuario_id, contenido_id, motivo, fecha_reporte
  `;
  const { rows } = await pool.query(q, [usuario_id, contenido_id, motivo]);
  return rows[0];
};

// ---------------------------------------------------------
// Cuenta los reportes DISTINTOS de un contenido. Como el UNIQUE ya impide
// duplicados por usuario, COUNT(*) == cantidad de usuarios distintos que
// reportaron. Devuelve número (el driver pg devuelve string en COUNT).
// ---------------------------------------------------------
const countReportesByContenido = async (contenidoId, client = pool) => {
  const q = `SELECT COUNT(*)::int AS total FROM reporte WHERE contenido_id = $1`;
  const { rows } = await client.query(q, [contenidoId]);
  return rows[0].total;
};

// ---------------------------------------------------------
// Detecta de qué subtipo es un contenido y trae lo necesario para validar
// y para inactivar. Devuelve:
//   { tipo: 'tema'|'comentario', contenido_id, autor_id, estado,
//     categoria_id (si tema), tema_id (si comentario) }
// o null si el contenido_id no existe como tema ni comentario.
// ---------------------------------------------------------
const getContenidoTipo = async (contenidoId) => {
  const q = `
    SELECT con.id AS contenido_id, con.autor_id,
      CASE WHEN t.contenido_id IS NOT NULL THEN 'tema'
           WHEN c.contenido_id IS NOT NULL THEN 'comentario'
           ELSE NULL END AS tipo,
      t.estado AS tema_estado,
      t.categoria_id AS tema_categoria_id,
      c.estado AS comentario_estado,
      c.tema_id AS comentario_tema_id,
      c.categoria_id AS comentario_categoria_id
    FROM contenido con
    LEFT JOIN tema t ON t.contenido_id = con.id
    LEFT JOIN comentario c ON c.contenido_id = con.id
    WHERE con.id = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [contenidoId]);
  const r = rows[0];
  if (!r || !r.tipo) return null;

  if (r.tipo === 'tema') {
    return {
      tipo: 'tema',
      contenido_id: r.contenido_id,
      autor_id: r.autor_id,
      estado: r.tema_estado,
      categoria_id: r.tema_categoria_id
    };
  }
  return {
    tipo: 'comentario',
    contenido_id: r.contenido_id,
    autor_id: r.autor_id,
    estado: r.comentario_estado,
    tema_id: r.comentario_tema_id,
    categoria_id: r.comentario_categoria_id
  };
};

const createReporteCategoria = async ({ usuario_id, categoria_id, motivo }) => {
  const q = `
    INSERT INTO reporte (usuario_id, categoria_id, motivo)
    VALUES ($1, $2, $3)
    RETURNING id, usuario_id, categoria_id, motivo, fecha_reporte
  `;
  const { rows } = await pool.query(q, [usuario_id, categoria_id, motivo]);
  return rows[0];
};
 
const countReportesByCategoria = async (categoriaId, client = pool) => {
  const q = `SELECT COUNT(*)::int AS total FROM reporte WHERE categoria_id = $1`;
  const { rows } = await client.query(q, [categoriaId]);
  return rows[0].total;
};

// ---------------------------------------------------------
// Desglose de reportes de un CONTENIDO (tema/comentario) para el umbral
// dinámico. Resuelve la categoría del contenido (tema.categoria_id, o la del
// comentario directo, o la del tema al que responde) y devuelve:
//   n = participantes de esa categoría (participacion_categoria)
//   p = reportes de este contenido hechos por participantes de la categoría
//   v = reportes hechos por visitantes (no participan)
// Como el UNIQUE por (usuario, contenido) impide reportes duplicados, cada
// reporte es un usuario distinto → p/v cuentan usuarios distintos.
// ---------------------------------------------------------
const getReportBreakdownByContenido = async (contenidoId, client = pool) => {
  const q = `
    WITH target AS (
      SELECT COALESCE(t.categoria_id, c.categoria_id, tt.categoria_id) AS categoria_id
      FROM contenido con
      LEFT JOIN tema t ON t.contenido_id = con.id
      LEFT JOIN comentario c ON c.contenido_id = con.id
      LEFT JOIN tema tt ON tt.contenido_id = c.tema_id
      WHERE con.id = $1
    )
    SELECT
      (SELECT categoria_id FROM target) AS categoria_id,
      (SELECT COUNT(*) FROM participacion_categoria pc
         WHERE pc.categoria_id = (SELECT categoria_id FROM target))::int AS n,
      COUNT(*) FILTER (WHERE pc.usuario_id IS NOT NULL)::int AS p,
      COUNT(*) FILTER (WHERE pc.usuario_id IS NULL)::int AS v
    FROM reporte r
    LEFT JOIN participacion_categoria pc
      ON pc.usuario_id = r.usuario_id
     AND pc.categoria_id = (SELECT categoria_id FROM target)
    WHERE r.contenido_id = $1
  `;
  const { rows } = await client.query(q, [contenidoId]);
  return { n: rows[0]?.n ?? 0, p: rows[0]?.p ?? 0, v: rows[0]?.v ?? 0 };
};

// Desglose análogo para reportes de una CATEGORÍA.
const getReportBreakdownByCategoria = async (categoriaId, client = pool) => {
  const q = `
    SELECT
      (SELECT COUNT(*) FROM participacion_categoria pc WHERE pc.categoria_id = $1)::int AS n,
      COUNT(*) FILTER (WHERE pc.usuario_id IS NOT NULL)::int AS p,
      COUNT(*) FILTER (WHERE pc.usuario_id IS NULL)::int AS v
    FROM reporte r
    LEFT JOIN participacion_categoria pc
      ON pc.usuario_id = r.usuario_id AND pc.categoria_id = $1
    WHERE r.categoria_id = $1
  `;
  const { rows } = await client.query(q, [categoriaId]);
  return { n: rows[0]?.n ?? 0, p: rows[0]?.p ?? 0, v: rows[0]?.v ?? 0 };
};

export { createReporte, countReportesByContenido, getContenidoTipo, createReporteCategoria, countReportesByCategoria,
  getReportBreakdownByContenido, getReportBreakdownByCategoria };
