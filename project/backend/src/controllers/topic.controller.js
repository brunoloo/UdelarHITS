import { createTopicService } from '../services/topic.service.js';

const createTopic = async (req, res) => {
  try {
    const topic = await createTopicService(req.user.id, req.body);
    return res.status(201).json({ ok: true, data: topic });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    if (error.code === 'FORBIDDEN') return res.status(403).json({ ok: false, message: error.message });
    if (error.code === 'TITULO_EXISTS') return res.status(409).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

export { createTopic };