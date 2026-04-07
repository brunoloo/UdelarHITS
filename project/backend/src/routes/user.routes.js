import { Router } from 'express';
import { getMe, getUsers, getUserProfile, updateUserProfile, changeUserPassword } from '../controllers/user.controller.js';
import { protect, isAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/me', protect, getMe); // Obtener id
router.get('/', protect, isAdmin, getUsers); // Obtener lista de usuarios
router.get('/:nickname', protect, isAdmin, getUserProfile); // Obtener información del usuario

router.put('/profile', protect, updateUserProfile); // Actualizar info usuario
router.put('/change-password', protect, changeUserPassword); // Actualizar contraseña

export default router;