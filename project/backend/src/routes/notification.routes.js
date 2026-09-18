import { Router } from 'express';
import { getMyNotifications, getUnreadCount, markAsRead, getNotification, markAllRead, deleteNotification } from '../controllers/notification.controller.js';
import { getVapidKey, subscribe, unsubscribe, setEnabled } from '../controllers/push.controller.js';
import { protect } from '../middlewares/auth.middleware.js';

const router = Router();

// Web Push. Van ANTES de '/:id' por prolijidad: '/:id' matchea un solo segmento
// así que hoy no hay colisión, pero declararlas arriba evita la sorpresa el día
// que alguien agregue una ruta con comodín.
// unsubscribe es POST y no DELETE porque apiDelete del cliente HTTP compartido
// (frontend/src/api/client.js) no manda body, y no vale tocarlo por esto.
router.get('/push/vapid-key', protect, getVapidKey);         // Clave pública VAPID (null = push no configurado)
router.post('/push/subscribe', protect, subscribe);          // Alta/upsert de un dispositivo
router.post('/push/unsubscribe', protect, unsubscribe);      // Baja (con endpoint: uno; sin él: todos)
router.patch('/push/enabled', protect, setEnabled);          // Toggle global { activado: boolean }

router.get('/', protect, getMyNotifications);               // Listar mis notificaciones
router.get('/unread-count', protect, getUnreadCount);       // Contar no-leídas (badge)
router.get('/:id', protect, getNotification);               // Ver una notificación
router.patch('/:id/read', protect, markAsRead);             // Marcar como leída
router.patch('/read-all', protect, markAllRead);            // Marcar todas las notificaciones como leída
router.delete('/:id', protect, deleteNotification);         // Eliminar la notificación

export default router;
