import { createUserReport, hasAlreadyReported, getPendingUserReports, resolveUserReport, getReportById, deleteUserReport } from '../repositories/report-user.repository.js';
import { getUserByNickname, updateUserEstadoById } from '../repositories/user.repository.js';

const reportUserService = async (reportadorId, nickname, motivo) => {
  if (!motivo || motivo.trim().length < 10) {
    const err = new Error('El motivo debe tener al menos 10 caracteres');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  if (motivo.trim().length > 1000) {
    const err = new Error('El motivo no puede superar los 1000 caracteres');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const user = await getUserByNickname(nickname);
  if (!user) {
    const err = new Error('Usuario no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (user.id === reportadorId) {
    const err = new Error('No podés reportarte a vos mismo');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const already = await hasAlreadyReported(reportadorId, user.id);
  if (already) {
    const err = new Error('Ya reportaste a este usuario');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  return await createUserReport(reportadorId, user.id, motivo.trim());
};

const getPendingReportsService = async () => {
  return await getPendingUserReports();
};

const resolveReportService = async (reportId, decision) => {
  if (!['levantar', 'ban'].includes(decision)) {
    const err = new Error('Decisión inválida');
    err.code = 'BAD_REQUEST';
    throw err;
  }

  const report = await getReportById(reportId);
  if (!report || report.estado !== 'pendiente') {
    const err = new Error('Reporte no encontrado o ya resuelto');
    err.code = 'NOT_FOUND';
    throw err;
  }

  if (decision === 'levantar') {
    await deleteUserReport(reportId);
    return { id: reportId, decision: 'levantar' };
  }

  // decision === 'ban': solo cambia el estado del usuario a 'ban'. Se conserva
  // su contenido, avatar/banner y seguidores (a diferencia de la baja de cuenta).
  const resolved = await resolveUserReport(reportId, decision);
  await updateUserEstadoById(report.usuario_reportado_id, 'ban');

  return resolved;
};

export { reportUserService, getPendingReportsService, resolveReportService };