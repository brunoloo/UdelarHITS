import { votePollService } from '../services/encuesta.service.js';

const votePoll = async (req, res) => {
  try {
    const { id } = req.params;
    const { opcion_id } = req.body;
    const encuesta = await votePollService(req.user.id, id, opcion_id);
    return res.status(200).json({ ok: true, data: encuesta });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

export { votePoll };
