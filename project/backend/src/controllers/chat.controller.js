import pool from '../config/db.js';
import {
  getOrCreateConversation,
  getConversationsByUserId,
  getMessages,
  createMessage,
  markMessagesAsRead,
  userBelongsToConversation,
  getOtherUserId,
  getVisibleSince,
  softDeleteConversation,
} from '../repositories/chat.repository.js';
import { isBlocked } from '../repositories/block.repository.js';

export const getConversations = async (req, res) => {
  try {
    const conversations = await getConversationsByUserId(req.user.id);
    return res.json({ ok: true, data: conversations });
  } catch {
    return res.status(500).json({ ok: false, message: 'Error interno' });
  }
};

export const getOrStartConversation = async (req, res) => {
  try {
    const { nickname } = req.params;
    const { rows } = await pool.query(
      "SELECT id, nickname, url_imagen, estado FROM usuario WHERE nickname = $1 AND estado = 'activo'",
      [nickname]
    );
    if (!rows[0]) {
      return res.status(404).json({ ok: false, message: 'Usuario no encontrado' });
    }
    const other = rows[0];
    if (other.id === req.user.id) {
      return res.status(400).json({ ok: false, message: 'No podés chatear con vos mismo' });
    }
    if (await isBlocked(req.user.id, other.id)) {
      return res.status(403).json({ ok: false, message: 'No podés chatear con este usuario' });
    }
    const conversacion_id = await getOrCreateConversation(req.user.id, other.id);
    return res.json({
      ok: true,
      data: {
        conversacion_id,
        usuario: { id: other.id, nickname: other.nickname, url_imagen: other.url_imagen },
      },
    });
  } catch (err) {
    console.error('chat.getOrStartConversation error:', err);
    return res.status(500).json({ ok: false, message: 'Error interno' });
  }
};

export const getConversationMessages = async (req, res) => {
  try {
    const convId = Number(req.params.conversacion_id);
    if (!Number.isInteger(convId) || convId < 1) {
      return res.status(400).json({ ok: false, message: 'ID inválido' });
    }
    const belongs = await userBelongsToConversation(convId, req.user.id);
    if (!belongs) {
      return res.status(403).json({ ok: false, message: 'No tenés acceso a esta conversación' });
    }
    const before = req.query.before ? Number(req.query.before) : null;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const visibleSince = await getVisibleSince(convId, req.user.id);
    const messages = await getMessages(convId, { before, limit, visibleSince });
    return res.json({ ok: true, data: messages });
  } catch {
    return res.status(500).json({ ok: false, message: 'Error interno' });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const convId = Number(req.params.conversacion_id);
    if (!Number.isInteger(convId) || convId < 1) {
      return res.status(400).json({ ok: false, message: 'ID inválido' });
    }
    const belongs = await userBelongsToConversation(convId, req.user.id);
    if (!belongs) {
      return res.status(403).json({ ok: false, message: 'No tenés acceso a esta conversación' });
    }
    const otherUserId = await getOtherUserId(convId, req.user.id);
    if (otherUserId && await isBlocked(req.user.id, otherUserId)) {
      return res.status(403).json({ ok: false, message: 'No podés enviar mensajes a este usuario' });
    }
    const cuerpo = req.body.cuerpo?.trim();
    if (!cuerpo) {
      return res.status(400).json({ ok: false, message: 'El mensaje no puede estar vacío' });
    }
    if (cuerpo.length > 2000) {
      return res.status(400).json({ ok: false, message: 'El mensaje supera los 2000 caracteres' });
    }
    const message = await createMessage({
      conversacion_id: convId,
      autor_id: req.user.id,
      cuerpo,
    });

    const io = req.app.get('io');
    if (io && otherUserId) {
      io.to(`user:${otherUserId}`).emit('mensaje:nuevo', message);
      io.to(`user:${otherUserId}`).emit('mensaje:leido', { conversacion_id: convId });
    }

    return res.status(201).json({ ok: true, data: message });
  } catch {
    return res.status(500).json({ ok: false, message: 'Error interno' });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const convId = Number(req.params.conversacion_id);
    if (!Number.isInteger(convId) || convId < 1) {
      return res.status(400).json({ ok: false, message: 'ID inválido' });
    }
    const belongs = await userBelongsToConversation(convId, req.user.id);
    if (!belongs) {
      return res.status(403).json({ ok: false, message: 'No tenés acceso a esta conversación' });
    }
    await markMessagesAsRead(convId, req.user.id);

    const otherUserId = await getOtherUserId(convId, req.user.id);
    const io = req.app.get('io');
    if (io && otherUserId) {
      io.to(`user:${otherUserId}`).emit('mensaje:leido', { conversacion_id: convId });
    }

    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ ok: false, message: 'Error interno' });
  }
};

export const deleteConversation = async (req, res) => {
  try {
    const convId = Number(req.params.conversacion_id);
    if (!Number.isInteger(convId) || convId < 1) {
      return res.status(400).json({ ok: false, message: 'ID inválido' });
    }
    const belongs = await userBelongsToConversation(convId, req.user.id);
    if (!belongs) {
      return res.status(403).json({ ok: false, message: 'No tenés acceso a esta conversación' });
    }
    await softDeleteConversation(convId, req.user.id);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ ok: false, message: 'Error interno' });
  }
};
