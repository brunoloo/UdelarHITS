import { createTopicService, getTopicsService, getTopicByIdService, getMyTopicsService, 
  updateTopicService, deleteTopicService, activeTopicService } from '../services/topic.service.js';

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

const getTopics = async (req, res) => {
  try {
    const topics = await getTopicsService();
    return res.status(200).json({ ok: true, data: topics });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const getTopicById = async (req, res) => {
  try {
    const { id } = req.params;
    const topic = await getTopicByIdService(id);
    return res.status(200).json({ ok: true, data: topic });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const getMyTopics = async (req, res) => {
  try {
    const topics = await getMyTopicsService(req.user.id);
    return res.status(200).json({ ok: true, data: topics });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const updateTopic = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await updateTopicService(req.user.id, id, req.body);
    return res.status(200).json({ ok: true, data: updated });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    if (error.code === 'FORBIDDEN') return res.status(403).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const deleteTopic = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await deleteTopicService(req.user.id, req.user.rol, id);
    return res.status(200).json({ ok: true, data: updated });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    if (error.code === 'FORBIDDEN') return res.status(403).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const activeTopic = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await activeTopicService(req.user.id, req.user.rol, id);
    return res.status(200).json({ ok: true, data: updated });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    if (error.code === 'FORBIDDEN') return res.status(403).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

export { createTopic, getTopics, getTopicById, getMyTopics, updateTopic, deleteTopic, activeTopic };