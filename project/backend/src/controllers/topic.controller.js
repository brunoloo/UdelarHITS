import { createTopicService, getTopicsService, getTopicByIdService, getMyTopicsService, 
  updateTopicService, deleteTopicService, activeTopicService, 
  getTopicsByCategoryIdService, getTopicsByUserIdService, 
  getRecentTopicsService, getTrendingTopicService, getTopicEditHistoryService,
  pinTopicCommentService, unpinTopicCommentService } from '../services/topic.service.js';

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
    const result = await deleteTopicService(req.user.id, req.user.rol, id);

    const message = result.action === 'deleted'
      ? 'El tema fue eliminado definitivamente'
      : 'El tema fue desactivado porque contenía comentarios de otros usuarios';

    return res.status(200).json({ ok: true, message, data: result });
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

const getTopicsByCategory = async (req, res) => {
  try {
    const { categoriaId } = req.params;
    const topics = await getTopicsByCategoryIdService(categoriaId);
    return res.status(200).json({ ok: true, data: topics });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const getTopicsByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!/^\d+$/.test(userId)) {
      return res.status(400).json({ ok: false, message: 'userId inválido' });
    }
    const topics = await getTopicsByUserIdService(userId, req.user?.id ?? null, req.user?.rol ?? null);
    return res.status(200).json({ ok: true, data: topics });
  } catch (error) {
    if (error.code === 'FORBIDDEN') return res.status(403).json({ ok: false, message: error.message });
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const getRecentTopicsList = async (req, res, next) => {
  try {
    const topics = await getRecentTopicsService(req.query.limit);
    return res.status(200).json({ ok: true, data: topics });
  } catch (error) {
    next(error);
  }
};

const getTrendingTopicItem = async (req, res, next) => {
  try {
    const topic = await getTrendingTopicService(req.query.days);
    return res.status(200).json({ ok: true, data: topic });
  } catch (error) {
    next(error);
  }
};

const getTopicEditHistory = async (req, res, next) => {
  try {
    const history = await getTopicEditHistoryService(req.params.id);
    return res.status(200).json({ ok: true, data: history });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const pinTopicComment = async (req, res) => {
  try {
    const { id } = req.params;
    const { item_id } = req.body;
    await pinTopicCommentService(req.user.id, req.user.rol, id, item_id);
    return res.status(200).json({ ok: true, message: 'Fijado' });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    if (error.code === 'FORBIDDEN') return res.status(403).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const unpinTopicComment = async (req, res) => {
  try {
    const { id } = req.params;
    await unpinTopicCommentService(req.user.id, req.user.rol, id);
    return res.status(200).json({ ok: true, message: 'Desanclado' });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    if (error.code === 'FORBIDDEN') return res.status(403).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

export { createTopic, getTopics, getTopicById, getMyTopics, updateTopic, deleteTopic,
  activeTopic, getTopicsByCategory, getTopicsByUser, getRecentTopicsList, getTrendingTopicItem, getTopicEditHistory,
  pinTopicComment, unpinTopicComment };