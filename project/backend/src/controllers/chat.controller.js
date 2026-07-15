import pool from '../config/db.js';
import {
  getOrCreateConversation,
  getConversationsByUserId,
  getConversationForUser,
  getMessages,
  createMessage,
  markMessagesAsRead,
  getUnreadTotal,
  softDeleteConversation,
} from '../repositories/chat.repository.js';
import { isBlocked } from '../repositories/block.repository.js';
import { tryOpenConversation, touchConversation, releaseConversation } from '../utils/chatLoad.js';

export const getConversations = async (req, res) => {
  try {
    const conversations = await getConversationsByUserId(req.user.id);
    return res.json({ ok: true, data: conversations });
  } catch {
    return res.status(500).json({ ok: false, message: 'Error interno' });
  }
};

// Badge del nav: solo el total de no-leídos, sin cargar la lista completa de
// conversaciones (que calcula último mensaje + unread POR conversación).
export const getUnreadCount = async (req, res) => {
  try {
    const total = await getUnreadTotal(req.user.id);
    return res.json({ ok: true, data: { total } });
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
    // Defensa 1: límite de conversaciones activas simultáneas. Solo bloquea
    // ABRIR una conversación que no estaba activa; las que ya están en curso
    // (incluida esta, si ya figura en el registro) siguen sin interrupción, y
    // el resto del sitio no se ve afectado.
    if (!tryOpenConversation(conversacion_id, req.user.id)) {
      return res.status(503).json({
        ok: false,
        message: 'El chat está muy activo en este momento — el resto del sitio sigue disponible con normalidad. Probá de nuevo en unos minutos.',
      });
    }
    // Primera página de mensajes en la misma respuesta: abrir un chat era una
    // cascada de dos requests (resolver conversación → pedir mensajes) y el
    // segundo viaje completo se elimina acá.
    const conv = await getConversationForUser(conversacion_id, req.user.id);
    const mensajes = await getMessages(conversacion_id, {
      limit: 50,
      visibleSince: conv?.visible_since ?? null,
    });
    return res.json({
      ok: true,
      data: {
        conversacion_id,
        usuario: { id: other.id, nickname: other.nickname, url_imagen: other.url_imagen },
        mensajes,
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
    // Pertenencia + visible_since en un solo viaje (antes eran dos queries
    // sobre la misma fila de conversacion).
    const conv = await getConversationForUser(convId, req.user.id);
    if (!conv) {
      return res.status(403).json({ ok: false, message: 'No tenés acceso a esta conversación' });
    }
    const before = req.query.before ? Number(req.query.before) : null;
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const messages = await getMessages(convId, { before, limit, visibleSince: conv.visible_since });
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
    const conv = await getConversationForUser(convId, req.user.id);
    if (!conv) {
      return res.status(403).json({ ok: false, message: 'No tenés acceso a esta conversación' });
    }
    const otherUserId = conv.otro_id;
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
    // Mantiene viva la conversación en el registro de chat activo. Continuar
    // una conversación existente nunca se bloquea por el límite.
    touchConversation(convId, req.user.id);

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
    const conv = await getConversationForUser(convId, req.user.id);
    if (!conv) {
      return res.status(403).json({ ok: false, message: 'No tenés acceso a esta conversación' });
    }
    await markMessagesAsRead(convId, req.user.id);

    const io = req.app.get('io');
    if (io && conv.otro_id) {
      io.to(`user:${conv.otro_id}`).emit('mensaje:leido', { conversacion_id: convId });
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
    const conv = await getConversationForUser(convId, req.user.id);
    if (!conv) {
      return res.status(403).json({ ok: false, message: 'No tenés acceso a esta conversación' });
    }
    await softDeleteConversation(convId, req.user.id);
    // Cierre explícito: libera el lugar de este usuario en el registro de
    // chat activo (la conversación libera su cupo si no queda nadie).
    releaseConversation(convId, req.user.id);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ ok: false, message: 'Error interno' });
  }
};
