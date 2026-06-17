import { reportUserService, getPendingReportsService, resolveReportService } from '../services/report-user.service.js';

const reportUser = async (req, res) => {
  try {
    const { nickname } = req.params;
    const { motivo } = req.body;
    const report = await reportUserService(req.user.id, nickname, motivo);
    return res.status(201).json({ ok: true, data: report });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    if (error.code === '23505') return res.status(400).json({ ok: false, message: 'Ya reportaste a este usuario' });
    return res.status(500).json({ ok: false, message: 'Error interno del servidor' });
  }
};

const getPendingReports = async (req, res) => {
  try {
    const reports = await getPendingReportsService();
    return res.status(200).json({ ok: true, data: reports });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Error interno del servidor' });
  }
};

const resolveReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { decision } = req.body;
    const resolved = await resolveReportService(parseInt(id), decision);
    return res.status(200).json({ ok: true, data: resolved });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Error interno del servidor' });
  }
};

export { reportUser, getPendingReports, resolveReport };