import { Router } from 'express';
import { registerUser, loginUser, getUserProfile, 
    updateUserProfile, changeUserPassword } from '../controllers/user.controller.js';

const router = Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/profile', getUserProfile);
router.put('/profile', updateUserProfile);
router.put('/change-password', changeUserPassword);

export default router;