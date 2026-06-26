import { createReplyService, getRepliesByCategoryIdService,
  getRepliesByTopicIdService, deleteReplyService, getMyRepliesService,
  getRepliesByUserIdService, updateReplyService, getRepliesByCommentIdService, getReplyByIdService, getReplyEditHistoryService,
  getReplyContextService, getLikedCommentsByUserIdService } from '../services/reply.service.js';
import { detectAttachmentType } from '../utils/validateAttachment.js';

const createReply = async (req, res) => {
  try {
    // En multipart, los campos vienen como strings ('' → undefined).
    const clean = (v) => (v === undefined || v === '' ? undefined : v);
    const fields = {
      cuerpo: req.body.cuerpo,
      tema_id: clean(req.body.tema_id),
      categoria_id: clean(req.body.categoria_id),
      comentario_padre_id: clean(req.body.comentario_padre_id),
    };

    // Validar cada archivo por sus magic numbers (no por mimetype, spoofeable).
    const files = req.files || [];
    const validados = [];
    for (const f of files) {
      const tipo = await detectAttachmentType(f.buffer);
      if (!tipo) {
        return res.status(400).json({ ok: false, message: `Tipo de archivo no permitido: ${f.originalname}` });
      }
      validados.push({ buffer: f.buffer, originalname: f.originalname, size: f.size, tipo });
    }

    const reply = await createReplyService(req.user.id, fields, validados);
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
    const userId = req.user?.id || null;
    const replies = await getRepliesByCategoryIdService(categoriaId, userId);
    return res.status(200).json({ ok: true, data: replies });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const getRepliesByTopic = async (req, res) => {
  try {
    const { topicId } = req.params;
    const userId = req.user?.id || null;
    const replies = await getRepliesByTopicIdService(topicId, userId);
    return res.status(200).json({ ok: true, data: replies });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const deleteReply = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteReplyService(req.user.id, req.user.rol, id);
    const message = result.action === 'deleted'
      ? 'Comentario eliminado definitivamente'
      : 'El comentario fue ocultado porque tenía respuestas';

    return res.status(200).json({ ok: true, message, data: result });
  } catch (error) {
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
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
    if (!/^\d+$/.test(userId)) {
      return res.status(400).json({ ok: false, message: 'userId inválido' });
    }
    const replies = await getRepliesByUserIdService(userId, req.user?.id || null);
    return res.status(200).json({ ok: true, data: replies });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const getLikedReplies = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!/^\d+$/.test(userId)) {
      return res.status(400).json({ ok: false, message: 'userId inválido' });
    }
    const replies = await getLikedCommentsByUserIdService(userId, req.user?.id || null);
    return res.status(200).json({ ok: true, data: replies });
  } catch (error) {
    if (error.code === 'FORBIDDEN') return res.status(403).json({ ok: false, message: error.message });
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

const getRepliesByComment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null;
    const replies = await getRepliesByCommentIdService(id, userId);
    return res.status(200).json({ ok: true, data: replies });
  } catch (error) {
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

const getReplyEditHistory = async (req, res, next) => {
  try {
    const history = await getReplyEditHistoryService(req.params.id);
    return res.status(200).json({ ok: true, data: history });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const getReplyContext = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id || null;
    const chain = await getReplyContextService(id, userId);
    return res.status(200).json({ ok: true, data: chain });
  } catch (error) {
    if (error.code === 'BAD_REQUEST') return res.status(400).json({ ok: false, message: error.message });
    if (error.code === 'NOT_FOUND') return res.status(404).json({ ok: false, message: error.message });
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

export { createReply, getRepliesByCategory, getRepliesByTopic, deleteReply, getMyReplies,
  getRepliesByUser, updateReply, getReplyById, getRepliesByComment, getReplyEditHistory,
  getReplyContext, getLikedReplies };