import { Router } from 'express';
import { registerUser, loginUser, logoutUser, createUserByAdmin, forgotPassword, verifyResetToken, resetPassword } from '../controllers/user.controller.js';
import { protect, isAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// Auth pública
router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/logout', protect, logoutUser);

// Recuperación de contraseña (pública)
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-token', verifyResetToken);
router.post('/reset-password', resetPassword);


// Crear usuario por admin
router.post('/admin/register', protect, isAdmin, createUserByAdmin);

export default router;