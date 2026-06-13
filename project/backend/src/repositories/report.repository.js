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

export { createReporte, countReportesByContenido, getContenidoTipo, createReporteCategoria, countReportesByCategoria };
