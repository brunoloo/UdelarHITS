import { Router } from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import {
  getConversations,
  getOrStartConversation,
  getConversationMessages,
  sendMessage,
  markAsRead,
} from '../controllers/chat.controller.js';

const router = Router();

router.get('/conversations', protect, getConversations);
router.get('/conversations/:nickname', protect, getOrStartConversation);
router.get('/conversations/:conversacion_id/messages', protect, getConversationMessages);
router.post('/conversations/:conversacion_id/messages', protect, sendMessage);
router.patch('/conversations/:conversacion_id/read', protect, markAsRead);

export default router;
