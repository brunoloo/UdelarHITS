import { Router } from 'express';
import { getMyNotifications, getUnreadCount, markAsRead, getNotification, markAllRead, deleteNotification } from '../controllers/notification.controller.js';
import { getVapidKey, subscribe, unsubscribe, setEnabled } from '../controllers/push.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = Router();

// unsubscribe es POST porque el cliente HTTP no envía body en DELETE.
router.get('/push/vapid-key', protect, getVapidKey);
router.post('/push/subscribe', protect, subscribe);
router.post('/push/unsubscribe', protect, unsubscribe);
router.patch('/push/enabled', protect, setEnabled);

router.get('/', protect, getMyNotifications);
router.get('/unread-count', protect, getUnreadCount);
router.get('/:id', protect, getNotification);
router.patch('/:id/read', protect, markAsRead);
router.patch('/read-all', protect, markAllRead);
router.delete('/:id', protect, deleteNotification);

export default router;
