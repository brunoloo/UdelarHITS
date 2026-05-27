import { Router } from 'express';
import { protect, isAdmin } from '../middlewares/auth.middleware.js';
import { uploadAvatar, uploadBanner } from '../config/multer.js';
import { showMe, updateMe, getUsers, getUserProfile, changeUserPassword, 
    banUser, activeUser, deleteUser, followUser, unfollowUser, 
    checkFollowing, updateAvatar, searchUsers, updateBanner, deleteBanner, 
    deleteAvatar, getSuggestedUsersList, getMostActiveUsersList } from '../controllers/user.controller.js';

const router = Router();

router.get('/', protect, isAdmin, getUsers);                     // Obtener lista de usuarios
router.get('/search', searchUsers);                              // Búsqueda de usuarios
router.get('/me', protect, showMe);                              // Obtener tu información de usuario
router.patch('/me', protect, updateMe);                          // Modificar datos personales
router.patch('/me/avatar', protect, uploadAvatar.single('avatar'), updateAvatar);  // Modifica el avatar
router.patch('/me/banner', protect, uploadBanner.single('banner'), updateBanner);  // Modifica el banner
router.delete('/me/banner', protect, deleteBanner);              // Elimina el banner
router.delete('/me/avatar', protect, deleteAvatar);              // Elimina el avatar          
router.put('/change-password', protect, changeUserPassword);     // Actualizar contraseña

router.get('/suggested', protect, getSuggestedUsersList);        // Lista sugerida de usuarios

router.get('/most-active', getMostActiveUsersList);              // Lista de usuarios más activos  

router.get('/:nickname', protect, getUserProfile);               // Obtener información del usuario pública

router.post('/:nickname/follow', protect, followUser);           // Seguir otro usuario
router.delete('/:nickname/follow', protect, unfollowUser);       // Dejar de seguir otro usuario
router.get('/:nickname/following', protect, checkFollowing);     // Chequear seguidor

router.patch('/:nickname/ban', protect, isAdmin, banUser);       // Suspender usuario
router.patch('/:nickname/active', protect, isAdmin, activeUser); // Activar usuario

router.delete('/:nickname/delete', protect, isAdmin, deleteUser) // Borrar usuario


export default router;