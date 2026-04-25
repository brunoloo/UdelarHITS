import { Router } from 'express';
import { showMe, updateMe, getUsers, getUserProfile, changeUserPassword, 
    getUserAvatar, banUser, activeUser, deleteUser, followUser, unfollowUser, checkFollowing } from '../controllers/user.controller.js';
import { protect, isAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

router.get('/', protect, isAdmin, getUsers);                     // Obtener lista de usuarios
router.get('/me', protect, showMe);                              // Obtener perfil de usuario
router.patch('/me', protect, updateMe);                          // Modificar datos personales
router.put('/change-password', protect, changeUserPassword);     // Actualizar contraseña

router.get('/:id/avatar', getUserAvatar);                        // Avatar público

router.get('/:nickname', protect, getUserProfile);               // Obtener información del usuario

router.post('/:nickname/follow', protect, followUser);           // Seguir otro usuario
router.delete('/:nickname/follow', protect, unfollowUser);       // Dejar de seguir otro usuario
router.get('/:nickname/following', protect, checkFollowing);     // Chequear seguidor

router.patch('/:nickname/ban', protect, isAdmin, banUser);       // Suspender usuario
router.patch('/:nickname/active', protect, isAdmin, activeUser); // Activar usuario

router.delete('/:nickname/delete', protect, isAdmin, deleteUser) // Borrar usuario


export default router;