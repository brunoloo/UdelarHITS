import { Router } from 'express';
import { protect, isAdmin, optionalAuth } from '../middlewares/auth.middleware.js';
import { uploadAvatar, uploadBanner } from '../config/multer.js';
import { showMe, showMeFull, updateMe, getUsers, getUserProfile, changeUserPassword,
    banUser, activeUser, deleteUser, followUser, unfollowUser, removeFollower,
    acceptFollowRequest, rejectFollowRequest,
    checkFollowing, updateAvatar, searchUsers, updateBanner, deleteBanner,
    deleteAvatar, getSuggestedUsersList, getMostActiveUsersList, deactivateAccount, togglePrivacy, toggleLikesPrivacy } from '../controllers/user.controller.js';
import { blockUser, unblockUser, getBlockedUsers } from '../controllers/block.controller.js';

const router = Router();

router.get('/', protect, isAdmin, getUsers);                     // Obtener lista de usuarios
router.get('/search', optionalAuth, searchUsers);                 // Búsqueda de usuarios
router.get('/me', protect, showMe);                              // Obtener tu información de usuario (liviano: solo user)
router.get('/me/full', protect, showMeFull);                     // Perfil propio completo (user + categorías + seguidores + seguidos)
router.patch('/me', protect, updateMe);                          // Modificar datos personales
router.patch('/me/avatar', protect, uploadAvatar.single('avatar'), updateAvatar);  // Modifica el avatar
router.patch('/me/banner', protect, uploadBanner.single('banner'), updateBanner);  // Modifica el banner
router.delete('/me/banner', protect, deleteBanner);              // Eliminar banner
router.delete('/me/avatar', protect, deleteAvatar);              // Eliminar avatar          
router.patch('/me/privacy', protect, togglePrivacy);             // Perfil privado
router.patch('/me/likes-privacy', protect, toggleLikesPrivacy);  // Me gusta privados
router.post('/me/deactivate', protect, deactivateAccount);       // Desactivar cuenta
router.put('/change-password', protect, changeUserPassword);     // Actualizar contraseña


router.get('/suggested', protect, getSuggestedUsersList);        // Lista sugerida de usuarios

router.get('/most-active', getMostActiveUsersList);              // Lista de usuarios más activos

router.get('/blocked', protect, getBlockedUsers);                // Lista de usuarios bloqueados

router.get('/:nickname', protect, getUserProfile);               // Obtener información del usuario pública

router.post('/:nickname/follow', protect, followUser);           // Seguir otro usuario (o solicitar si es privado)
router.delete('/:nickname/follow', protect, unfollowUser);       // Dejar de seguir / cancelar solicitud
router.delete('/:nickname/follower', protect, removeFollower);   // Remover a :nickname de mis seguidores
router.post('/:nickname/follow/accept', protect, acceptFollowRequest); // Aceptar solicitud de :nickname
router.post('/:nickname/follow/reject', protect, rejectFollowRequest); // Rechazar solicitud de :nickname
router.get('/:nickname/following', protect, checkFollowing);     // Chequear seguidor
router.post('/:nickname/block', protect, blockUser);             // Bloquear usuario
router.delete('/:nickname/block', protect, unblockUser);         // Desbloquear usuario

router.patch('/:nickname/ban', protect, isAdmin, banUser);       // Suspender usuario
router.patch('/:nickname/active', protect, isAdmin, activeUser); // Activar usuario

router.delete('/:nickname/delete', protect, isAdmin, deleteUser) // Borrar usuario


export default router;