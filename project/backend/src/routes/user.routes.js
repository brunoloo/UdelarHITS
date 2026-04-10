import { Router } from 'express';
import { showMe, updateMe, getUsers, getUserProfile, changeUserPassword, getUserAvatar } from '../controllers/user.controller.js';
import { protect, isAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', protect, isAdmin, getUsers); // Obtener lista de usuarios
router.get('/me', protect, showMe); // Obtener datos personales
router.patch('/me', protect, updateMe); // Modificar datos personales

router.get('/:id/avatar', getUserAvatar); // Avatar público

router.get('/:nickname', protect, isAdmin, getUserProfile); // Obtener información del usuario

router.put('/change-password', protect, changeUserPassword); // Actualizar contraseña

export default router;