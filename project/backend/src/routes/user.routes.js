import { Router } from 'express';
import { showMe, updateMe, getUsers, getUserProfile, changeUserPassword, 
    getUserAvatar, banUser, activeUser, deleteUser } from '../controllers/user.controller.js';
import { protect, isAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', protect, isAdmin, getUsers); // Obtener lista de usuarios
router.get('/me', protect, showMe);          // Obtener datos personales
router.patch('/me', protect, updateMe);      // Modificar datos personales
router.put('/change-password', protect, changeUserPassword);     // Actualizar contraseña

router.get('/:id/avatar', getUserAvatar); // Avatar público

router.get('/:nickname', protect, isAdmin, getUserProfile); // Obtener información del usuario

router.patch('/:nickname/ban', protect, isAdmin, banUser);       // Suspender usuario
router.patch('/:nickname/active', protect, isAdmin, activeUser); // Activar usuario

router.delete('/:nickname/delete', protect, isAdmin, deleteUser) // Borrar usuario


export default router;