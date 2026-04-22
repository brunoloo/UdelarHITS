import { createReplyService, getRepliesByCategoryIdService, 
  getRepliesByTopicIdService, deleteReplyService, getMyRepliesService, 
  getRepliesByUserIdService, updateReplyService, getReplyByIdService } from '../services/reply.service.js';

const createReply = async (req, res) => {
  try {
    console.log('body:', req.body);
    const reply = await createReplyService(req.user.id, req.body);
    return res.status(201).json({ ok: true, data: reply });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    if (error.code === 'FORBIDDEN') return res.status(403).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const getRepliesByCategory = async (req, res) => {
  try {
    const { categoriaId } = req.params;
    const replies = await getRepliesByCategoryIdService(categoriaId);
    return res.status(200).json({ ok: true, data: replies });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const getRepliesByTopic = async (req, res) => {
  try {
    const { topicId } = req.params;
    const replies = await getRepliesByTopicIdService(topicId);
    return res.status(200).json({ ok: true, data: replies });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const deleteReply = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteReplyService(req.user.id, req.user.rol, id);
    return res.status(200).json({ ok: true, data: deleted });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    if (error.code === 'FORBIDDEN') return res.status(403).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const getMyReplies = async (req, res) => {
  try {
    const replies = await getMyRepliesService(req.user.id);
    return res.status(200).json({ ok: true, data: replies });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const getRepliesByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const replies = await getRepliesByUserIdService(userId);
    return res.status(200).json({ ok: true, data: replies });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const getReplyById = async (req, res) => {
  try {
    const { id } = req.params;
    const reply = await getReplyByIdService(id);
    return res.status(200).json({ ok: true, data: reply });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const updateReply = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await updateReplyService(req.user.id, req.user.rol, id, req.body);
    return res.status(200).json({ ok: true, data: updated });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    if (error.code === 'FORBIDDEN') return res.status(403).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

export { createReply, getRepliesByCategory, getRepliesByTopic, deleteReply, getMyReplies, 
  getRepliesByUser, updateReply, getReplyById };