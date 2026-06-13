import { Router } from 'express';
import { getMyNotifications, getUnreadCount, markAsRead, getNotification, markAllRead, deleteNotification } from '../controllers/notification.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', protect, getMyNotifications);               // Listar mis notificaciones
router.get('/unread-count', protect, getUnreadCount);       // Contar no-leídas (badge)
router.get('/:id', protect, getNotification);               // Ver una notificación
router.patch('/:id/read', protect, markAsRead);             // Marcar como leída
router.patch('/read-all', protect, markAllRead);            // Marcar todas las notificaciones como leída
router.delete('/:id', protect, deleteNotification);         // Eliminar la notificación

export default router;