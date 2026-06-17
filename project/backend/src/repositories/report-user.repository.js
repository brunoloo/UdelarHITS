import pool from '../config/db.js';

const createUserReport = async (reportadorId, reportadoId, motivo) => {
  const q = `
    INSERT INTO reporte_usuario (reportador_id, usuario_reportado_id, motivo)
    VALUES ($1, $2, $3)
    RETURNING id, usuario_reportado_id, reportador_id, motivo, estado, fecha_creacion
  `;
  const { rows } = await pool.query(q, [reportadorId, reportadoId, motivo]);
  return rows[0];
};

const hasAlreadyReported = async (reportadorId, reportadoId) => {
  const q = `
    SELECT 1 FROM reporte_usuario
    WHERE reportador_id = $1 AND usuario_reportado_id = $2
      AND estado = 'pendiente'
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [reportadorId, reportadoId]);
  return rows.length > 0;
};

const getPendingUserReports = async () => {
  const q = `
    SELECT r.id, r.motivo, r.fecha_creacion,
      reportado.id AS reportado_id, reportado.nickname AS reportado_nickname,
      reportado.nombre AS reportado_nombre, reportado.url_imagen AS reportado_url_imagen,
      reportador.nickname AS reportador_nickname
    FROM reporte_usuario r
    JOIN usuario reportado ON reportado.id = r.usuario_reportado_id
    JOIN usuario reportador ON reportador.id = r.reportador_id
    WHERE r.estado = 'pendiente'
    ORDER BY r.fecha_creacion DESC
  `;
  const { rows } = await pool.query(q);
  return rows;
};

const resolveUserReport = async (reportId, decision) => {
  const q = `
    UPDATE reporte_usuario
    SET estado = 'resuelto', decision = $2, fecha_resolucion = NOW()
    WHERE id = $1 AND estado = 'pendiente'
    RETURNING id, usuario_reportado_id, decision
  `;
  const { rows } = await pool.query(q, [reportId, decision]);
  return rows[0] || null;
};

const getReportById = async (id) => {
  const q = `
    SELECT id, usuario_reportado_id, reportador_id, motivo, estado, decision
    FROM reporte_usuario WHERE id = $1
  `;
  const { rows } = await pool.query(q, [id]);
  return rows[0] || null;
};

const deleteUserReport = async (reportId) => {
  const q = `DELETE FROM reporte_usuario WHERE id = $1`;
  await pool.query(q, [reportId]);
};

export { createUserReport, hasAlreadyReported, getPendingUserReports, resolveUserReport, getReportById, deleteUserReport };
