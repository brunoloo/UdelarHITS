import { toggleReactionService, getReactionsService } from '../services/reaction.service.js';

const toggleReaction = async (req, res) => {
  try {
    const { contenidoId } = req.params;
    const { tipo } = req.body;
    const result = await toggleReactionService(req.user.id, contenidoId, tipo);
    res.json({ ok: true, data: result });
  } catch (err) {
    if (err.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: err.message });
    if (err.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: err.message });
    if (err.code === 'FORBIDDEN') return res.status(403).json({ ok: false, message: err.message });
    res.status(500).json({ ok: false, message: 'Error interno del servidor' });
  }
};

const getReactions = async (req, res) => {
  try {
    const { contenidoId } = req.params;
    const userId = req.user?.id || null;
    const result = await getReactionsService(contenidoId, userId);
    res.json({ ok: true, data: result });
  } catch (err) {
    if (err.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: err.message });
    if (err.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: err.message });
    res.status(500).json({ ok: false, message: 'Error interno del servidor' });
  }
};

export { toggleReaction, getReactions };