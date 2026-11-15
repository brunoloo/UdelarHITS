import { Router } from 'express';
import { protect, isAdmin, optionalAuth } from '../middlewares/auth.middleware.js';
import { uploadAvatar, uploadBanner } from '../config/multer.js';
import { showMe, showMeFull, updateMe, getUsers, getUserProfile, changeUserPassword,
    banUser, activeUser, deleteUser, followUser, unfollowUser, removeFollower,
    acceptFollowRequest, rejectFollowRequest,
    checkFollowing, updateAvatar, searchUsers, getMentionCandidates, updateBanner, deleteBanner,
    deleteAvatar, getSuggestedUsersList, getMostActiveUsersList, deactivateAccount, togglePrivacy, toggleLikesPrivacy } from '../controllers/user.controller.js';
import { blockUser, unblockUser, getBlockedUsers } from '../controllers/block.controller.js';

const router = Router();

router.get('/', protect, isAdmin, getUsers);
router.get('/search', optionalAuth, searchUsers);
router.get('/mentions', optionalAuth, getMentionCandidates);
router.get('/me', protect, showMe);
router.get('/me/full', protect, showMeFull);
router.patch('/me', protect, updateMe);
router.patch('/me/avatar', protect, uploadAvatar.single('avatar'), updateAvatar);
router.patch('/me/banner', protect, uploadBanner.single('banner'), updateBanner);
router.delete('/me/banner', protect, deleteBanner);
router.delete('/me/avatar', protect, deleteAvatar);
router.patch('/me/privacy', protect, togglePrivacy);
router.patch('/me/likes-privacy', protect, toggleLikesPrivacy);
router.post('/me/deactivate', protect, deactivateAccount);
router.put('/change-password', protect, changeUserPassword);


// Con sesión, sugerencias por afinidad; sin sesión, usuarios al azar.
router.get('/suggested', optionalAuth, getSuggestedUsersList);

router.get('/most-active', getMostActiveUsersList);

router.get('/blocked', protect, getBlockedUsers);

router.get('/:nickname', protect, getUserProfile);

router.post('/:nickname/follow', protect, followUser);
router.delete('/:nickname/follow', protect, unfollowUser);
router.delete('/:nickname/follower', protect, removeFollower);
router.post('/:nickname/follow/accept', protect, acceptFollowRequest);
router.post('/:nickname/follow/reject', protect, rejectFollowRequest);
router.get('/:nickname/following', protect, checkFollowing);
router.post('/:nickname/block', protect, blockUser);
router.delete('/:nickname/block', protect, unblockUser);

router.patch('/:nickname/ban', protect, isAdmin, banUser);
router.patch('/:nickname/active', protect, isAdmin, activeUser);

router.delete('/:nickname/delete', protect, isAdmin, deleteUser)


export default router;