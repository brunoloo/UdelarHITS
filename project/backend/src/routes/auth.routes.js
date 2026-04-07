import { Router } from 'express';
import { registerUser, loginUser, logoutUser, createUserByAdmin } from '../controllers/user.controller.js';
import { protect, isAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// Auth pública
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', logoutUser);

// Crear usuario por admin
router.post('/admin/register', protect, isAdmin, createUserByAdmin);

export default router;