import {
  getNotificationsByUserId,
  countUnreadByUserId,
  markNotificationAsRead,
  getNotificationById,
  markAllAsReadByUserId,
  deleteNotificationById
} from '../repositories/notification.repository.js';

// =========================================================
// Notification controller
// =========================================================

// Listar las notificaciones del usuario autenticado
const getMyNotifications = async (req, res) => {
  try {
    const notifs = await getNotificationsByUserId(req.user.id);
    return res.status(200).json({ ok: true, data: notifs });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

// Contar no-leídas (para el badge del leftnav)
const getUnreadCount = async (req, res) => {
  try {
    const total = await countUnreadByUserId(req.user.id);
    return res.status(200).json({ ok: true, data: { total } });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

// Marcar una notificación como leída
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await markNotificationAsRead(id, req.user.id);
    if (!result) {
      return res.status(404).json({ ok: false, message: 'Notificación no encontrada' });
    }
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

// Obtener una notificación específica del usuario
const getNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const notif = await getNotificationById(id, req.user.id);
    if (!notif) {
      return res.status(404).json({ ok: false, message: 'Notificación no encontrada' });
    }
    return res.status(200).json({ ok: true, data: notif });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const markAllRead = async (req, res) => {
  try {
    const count = await markAllAsReadByUserId(req.user.id);
    return res.status(200).json({ ok: true, data: { marked: count } });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await deleteNotificationById(id, req.user.id);
    if (!result) {
      return res.status(404).json({ ok: false, message: 'Notificación no encontrada' });
    }
    return res.status(200).json({ ok: true, data: result });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

export { getMyNotifications, getUnreadCount, markAsRead, getNotification, markAllRead, deleteNotification };